/* eslint-disable @typescript-eslint/no-unused-vars */
const fs = require( 'fs' );
const puppeteer = require( 'puppeteer' );
const getSource = require( 'get-source' );
const linesAndCols = require( 'lines-and-columns' );
const acorn = require( 'acorn' );
const walk = require( 'acorn-walk' );
const stringify = require( 'json-stable-stringify' );
const Promise = require( 'bluebird' );
const writeFilePromise = Promise.promisify( fs.writeFile );
const glob = require( 'glob' );

const signale = require( 'signale' );
const util = require( 'util' );


/*

	Function-level dependency tracking for 3js examples
		+ console logging

*/

process.on( 'unhandledRejection', ( reason/* , p */ ) => {

	console.error( 'unhandledRejection' );
	throw reason;

} );

process.on( 'uncaughtException', error => {

	console.error( 'uncaughtException' );
	console.error( error );
	process.exit( 1 );

} );


// modified (reduced), org. version by paul irish
const trackShaderCode = `var trackShaderShim = function (obj, propertyName, trackingCode, category ) {

	// this is directly from https://github.com/paulmillr/es6-shim
	function getPropertyDescriptor(obj, name) {
		var property = Object.getOwnPropertyDescriptor(obj, name);
		var proto = Object.getPrototypeOf(obj);
		while (property === undefined && proto !== null) {
			property = Object.getOwnPropertyDescriptor(proto, name);
			proto = Object.getPrototypeOf(proto);
		}
		return property;
	}

	var originalProperty = getPropertyDescriptor(obj, propertyName);
	var newProperty = { enumerable: originalProperty.enumerable };

	// read
	newProperty.get = function(val) {
		// console.log( { category } );
		if ( category === 'ShaderChunk' )
			window.trackShaderChunk( trackingCode );
		else if ( category === 'ShaderLib' )
			window.trackShaderLib( propertyName, trackingCode );
		// else
			// window.trackSomething( propertyName, trackingCode );

		return originalProperty.get ? originalProperty.get.call(this, val) : originalProperty.value;
	}

	Object.defineProperty(obj, propertyName, newProperty);

};`;


const TIMEOUT = 4000;

const defaultConfig = {

	urlBase: 'https://raw.githack.com/moraxy/three.js/automated/examples/',
	fileBase: __dirname + '/../',

	shaderLibPath: 'src/renderers/shaders/ShaderLib.js',
	shaderChunkPath: 'src/renderers/shaders/ShaderChunk.js',
	uniformsLibPath: 'src/renderers/shaders/UniformsLib.js',

	mainScriptFilename: 'three.module.js',
	mainScriptPath: 'build/three.module.js',

	examplesFilenameRegex: /(examples\/(?:webgl|webaudio|webvr|css.*?|misc)_.*?\.html)$/,

	resultsFile: 'trackFiles-results.',

	puppeteerOptions: [ '--mute-audio' ]

};

var config;

const seedRandom = fs.readFileSync( __dirname + '/seedrandom.min.js', 'utf8' );
const timekeeper = fs.readFileSync( __dirname + '/timekeeper.min.js', 'utf8' );

var source;
var acceptableScriptUrlsRx;
var sourceMapped;
var lines;
let singleMode; // same evil hack

let astCache = {};

let shaderLibs = {};
let shaderChunks = {};
let uniformsLibs = {};

var profilerRunning = false;

var modifiedTHREE;


/**
 * @param {puppeteer.Page} page
 * @param {Promise} promiseNetworkHasBeenIdle Resolves when the network has been idle for TIMEOUT ms
 */
function setupPage( page ) {

	const logger = signale.scope( 'setupPage' );

	logger.action( 'Setting up page...' );

	let loggedRequests = [];
	let consoleLog = [];
	let trackedShaders = {
		'ShaderChunk': [],
		'ShaderLib': {},
		'UniformsLib': []
	};
	let deps = {
		'uniq': [],
		'lines': {}
	};


	let setups = [
		//
		// basics
		//
		page.setViewport( { width: 320, height: 240 } ),


		//
		// tracking shims
		//
		page.evaluateOnNewDocument( seedRandom + timekeeper ),		// determinism
		page.evaluateOnNewDocument( trackShaderCode ),				// inject shaders-/uniforms-tracking code


		//
		// exposed functions
		//
		page.exposeFunction( 'trackShaderChunk', ( shader ) => {

			// console.log( `Pushing chunk ${shader}` );
			trackedShaders.ShaderChunk.push( shaderChunks[ shader ] );

		} ),

		page.exposeFunction( 'trackShaderLib', ( propertyName, shaderName ) => {

			// console.log( `Pushing lib ${shaderName}.${propertyName}` );
			trackedShaders.ShaderLib[ shaderName ] = shaderLibs[ shaderName ];

			// console.log( `Pushing uniforms for ${shaderName}` );
			trackedShaders.UniformsLib.push( ...shaderLibs[ shaderName ].uniformsRefs );

		} )

	];


	return Promise.all( setups )
		.then( () => {

			console.log( 'intial setup done, setting listeners...' );

			//
			// Listeners
			//
			page.on( 'console', msg => {

				logger.debug( `Console ${msg.text()}` );

				consoleLog.push( { type: 'console', msg: { type: msg.type(), text: msg.text(), location: msg.location(), args: msg.args().join( ' ' ) } } );

			} );

			page.on( 'pageerror', msg => {

				logger.debug( `PageError ${msg}` );

				consoleLog.push( { type: 'pageerror', msg: { name: msg.name, text: msg.message } } );

			} );

			page.on( 'request', req => {

				logger.debug( `Request ${req.method()} ${req.url()}` );

				loggedRequests.push( req.url() );

			} );

			console.log( 'listeners done' );

			return { loggedRequests, consoleLog, trackedShaders, deps };

		} );

}


function init( configOverrides = {} ) {

	const logger = signale.scope( 'init' );

	// apply overrides to default values
	config = Object.assign( defaultConfig, configOverrides );

	acceptableScriptUrlsRx = new RegExp( config.urlBase + '.*?(?<!min)\\.js$' );

	source = fs.readFileSync( config.fileBase + config.mainScriptPath, 'utf8' );
	lines = new linesAndCols.default( source );
	sourceMapped = getSource( config.fileBase + config.mainScriptPath );

	logger.debug( `Modify script at ${config.fileBase + config.mainScriptPath}` );
	modifiedTHREE = fs.readFileSync( config.fileBase + config.mainScriptPath, 'utf8' )
	+ `
	for ( const chunkName in ShaderChunk )
		trackShaderShim(ShaderChunk, chunkName, chunkName, "ShaderChunk" )

	for ( const libName in ShaderLib ) {
		trackShaderShim(ShaderLib[ libName ], "fragmentShader", libName, "ShaderLib" );
		trackShaderShim(ShaderLib[ libName ], "vertexShader", libName, "ShaderLib" );
	}

	for ( const uniformName in UniformsLib ) {
		for ( const subName in UniformsLib[ uniformName ] ) {
			trackShaderShim( UniformsLib[ uniformName ], subName, uniformName + '.' + subName, "UniformsLib" );
		}
	}

	debugger;`;

}


/**
* @param {string[]} urls
*/
function search( urls = [] ) {

	const logger = signale.scope( 'search' );

	if ( Array.isArray( urls ) && urls.length > 0 ) {

		//
		// Process the Shader Chunks
		//
		// https://astexplorer.net/#/gist/7697e565ae9610ea0f8386d2453e7763/ad16240d2b8781c2b7c8f6bf7dbb278ffefe1ab1
		const shaderChunkSource = fs.readFileSync( config.fileBase + config.shaderChunkPath, 'utf8' );
		const shaderChunkAst = acorn.parse( shaderChunkSource, { locations: true, sourceType: 'module' } );

		if ( ! shaderChunkAst ) {

			logger.error( `Couldn't create shaderChunkAst, aborting...` );
			process.exit( - 1 );

		}

		shaderChunks = shaderChunkAst.body.reduce( processShaderChunkAst, {} );


		//
		// Process the Uniforms Library
		//
		// https://astexplorer.net/#/gist/efab601013915b58740f6758f71dd226/8856d4eb8dc33cd5d280f12dbfc8a6ecd0d98e25
		const uniformsLibSource = fs.readFileSync( config.fileBase + config.uniformsLibPath, 'utf8' );
		const uniformsLibAst = acorn.parse( uniformsLibSource, { locations: true, sourceType: 'module' } );
		const uniformsLibNode = walk.findNodeAt( uniformsLibAst, null, null, ( nodeType, node ) => {

			return nodeType === 'VariableDeclarator' && node.id.name === 'UniformsLib' && node.init.type === 'ObjectExpression';

		} );

		if ( ! uniformsLibNode ) {

			logger.error( `Couldn't find uniformsLibNode, aborting...` );
			process.exit( - 1 );

		}

		uniformsLibs = uniformsLibNode.node.init.properties.reduce( processUniformsLibNodeProperties, {} );


		//
		// Process the Shader Library
		//
		shaderLibs = loadShaderLibrary( config.fileBase + config.shaderLibPath );


		return puppeteer.launch( { headless: true, devtools: false, dumpio: true, args: [ '--use-gl=swiftshader', ...config.puppeteerOptions ] } )
			.then( browser => {

				logger.debug( 'Browser launched' );

				return Promise.each( urls, ( url, index ) => {

					logger.debug( `${index + 1}/${urls.length} ${url}` );

					return gotoUrl( browser, url )
						.catch( err => {

							console.error( '\n\n-------\n\n', err, '\n\n------\n\n' );

							return true;

						} );

				} ).then( status => {

					logger.debug( 'Done, no more URLs left.', status.join( '\n' ) );

					logger.debug( 'Closing browser...' );
					return browser.close();

				} ).then( () => {

					logger.debug( 'Done' );

					return true;

				} )
					.catch( err => console.error( "Well.. that's it >", err ) );

			} );

	} else {

		logger.error( `search() expects an array` );

		return false;

	}

}


/**
 * from https://github.com/GoogleChrome/puppeteer/issues/1353#issuecomment-356561654
 * @param {puppeteer.Page} page
 * @param {number} timeout
 * @param {number} maxInflightRequests
 */
function waitForNetworkIdle( page, timeout, maxInflightRequests = 0 ) {

	const logger = signale.scope( 'waitForNetworkIdle' );

	page.on( 'request', onRequestStarted );
	page.on( 'requestfinished', onRequestFinished );
	page.on( 'requestfailed', onRequestFinished );
	page.on( 'load', pageLoaded );

	let inflight = 0;
	let loadedEvent;
	let fullyLoaded = new Promise( x => loadedEvent = x );
	let fulfill;
	let promise = new Promise( x => fulfill = x );
	let timeoutId = setTimeout( onTimeoutDone, timeout );
	return promise;

	function onTimeoutDone() {

		if ( ! promise.isFulfilled() ) {

			return fullyLoaded.then( () => {

				// logger.debug( `${TIMEOUT}ms since last request, fullyLoaded: ${fullyLoaded.isFulfilled()}, promise: ${promise.isFulfilled()} -> working...` );
				logger.debug( `${TIMEOUT}ms since last request -> working...` );

				page.removeListener( 'request', onRequestStarted );
				page.removeListener( 'requestfinished', onRequestFinished );
				page.removeListener( 'requestfailed', onRequestFinished );

				logger.debug( 'Network listeners removed' );

				fulfill();

				return true;

			} );

		}

	}

	async function onRequestStarted( interceptedRequest ) {

		inflight ++;

		if ( inflight > maxInflightRequests )
			clearTimeout( timeoutId );

		// if we intercept a request for our main script
		if ( interceptedRequest.url().endsWith( config.mainScriptFilename ) ) {

			// we answer instead with our modified version
			await interceptedRequest.respond( {
				status: 200,
				contentType: 'text/javascript',
				body: modifiedTHREE
			} );

			console.log( '3js INTERCEPTED' );

		} else {

			// console.log( 'NOPE:', interceptedRequest.url() );
			// otherwise continue as normal, only slightly delayed to allow for
			// the main script to be fully parsed
			// setTimeout( () => interceptedRequest.continue(), 500 );
			interceptedRequest.continue();

		}

	}

	function onRequestFinished() {

		if ( inflight === 0 )
			return;

		if ( inflight < 0 )
			logger.warn( 'inflight < 0 ?' );

		inflight --;

		if ( inflight === maxInflightRequests || ! fullyLoaded )
			timeoutId = setTimeout( onTimeoutDone, timeout );

	}

	function pageLoaded() {

		loadedEvent();

	}

}


/**
 * @param {puppeteer.Browser} browser
 */
async function gotoUrl( browser, url ) {

	const logger = signale.scope( 'gotoUrl' );

	logger.debug( 'newPage' );
	const page = await browser.newPage();

	const crudelyEscapedUrl = `${url.replace( config.urlBase, '' ).replace( /\/+/g, '_' ).replace( '.html', '' )}.json`;
	logger.info( url );

	//
	// setup our debugging starter
	//
	const client = await page.target().createCDPSession();
	await client.send( 'Runtime.enable' );
	await client.send( 'Debugger.enable' );
	client.addListener( 'Debugger.paused', async () => {

		if ( profilerRunning === false ) {

			profilerRunning = true;

			await client.send( 'Profiler.enable' );
			await client.send( 'Profiler.startPreciseCoverage', { callCount: true } );
			logger.debug( 'Started profiler' );

			await client.send( 'Debugger.resume' );

		}

	} );



	//
	// network interception and modification
	//
	await page.setRequestInterception( true );
	const promiseNetworkHasBeenIdle = waitForNetworkIdle( page, TIMEOUT, 0 );


	//
	// setup page
	//
	logger.debug( 'setupPage' );
	return setupPage( page )
		.then( ( { loggedRequests, consoleLog, trackedShaders, deps } ) => {

			//
			// goto url, wait for network idle, collect tracked data, signal we're finished
			//
			logger.debug( `Goto ${url}` );

			return page.goto( url, { timeout: 120000, waitUntil: 'load' } )
				.then( () => {

					logger.debug( 'Arrived' );

					return promiseNetworkHasBeenIdle
						.then( async () => {

							logger.debug( 'Network has been idle for long enough, working...' );

							await page.removeAllListeners( 'request' );

							logger.debug( 'All listeners removed' );

							profilerRunning = false;

							return true;

						} )
						.then( () => {

							logger.debug( 'Profiler.takePreciseCoverage' );

							return Promise.any( [
								client.send( 'Profiler.takePreciseCoverage' ),
								new Promise( x => x ).delay( 60000, false )
							] )
								.then( result => {

									if ( ! result ) {

										logger.error( 'Promise.delay triggered' );

									} else {

										logger.debug( `result.result.length: ${result.result.length}` );

										// Go thru all coverage-processed scripts
										for ( const script of result.result ) {

											// console.log( util.inspect( script, false, 4, true ) );
											// Either the main three.js file
											if ( new RegExp( '/' + config.mainScriptFilename + '$' ).test( script.url ) === true ) {

												logger.debug( '3js script.functions.length:', script.functions.length );

												for ( const func of script.functions )
													processThreeJsCoverage( func, deps );

											} else if ( acceptableScriptUrlsRx.test( script.url ) === true ) {

												// or all *.js files from urlBase, except those named *.min.js

												logger.debug( `other script.functions.length: ${script.functions.length} in ${script.url}` );

												for ( const func of script.functions )
													processOtherCoverage( func, script, deps );

											}

										}

									}

									return client.send( 'Profiler.stopPreciseCoverage' );

								} )
								.catch( err => logger.error( `takePreciseCoverage failed: ${err}` ) );

						} )
						.then( () => {

							logger.debug( `Collecting tracked data...` );
							deps.external = loggedRequests.filter( ( name, index ) => loggedRequests.indexOf( name ) === index /* && name.startsWith( urlBase ) === true */ );
							deps.shaderChunks = trackedShaders.ShaderChunk;
							deps.shaderLibs = trackedShaders.ShaderLib;
							deps.uniforms = trackedShaders.UniformsLib;

							const results = {
								deps: cleanupDependencies( deps ),
								console: consoleLog
							};

							return writeFilePromise(
								`trackedResults-${crudelyEscapedUrl}`,
								stringify( { file: page.url(), results: results } ),
								'utf8'
							);

						} )
						.catch( err => console.error( 'ERR final collection failed >', err ) );

				} )
				.catch( err => {

					logger.error( `> Page.goto failed: ${err}\nSTACK:${err.stack}\nURL: ${url}` );

					fs.writeFileSync( `${new Date().getTime()}.err`, url, 'utf8' );

					// no return false, we carry on without that url
					return page.close();

				} );

		} )
		.then( () => page.close() )
		.catch( err => {

			console.error( 'everything failed >', err );
			process.exit( - 1 );

		} );

}


function processShaderLibName( entry ) {

	const shader = {
		name: entry.key.name,
		vertexShader: { group: undefined, name: undefined, linked: undefined },
		fragmentShader: { group: undefined, name: undefined, linked: undefined },
		uniformsRefs: [],
		start: entry.loc.start,
		end: entry.loc.end
	};

	return shader;

}


function addPropertiesToShader( shaderOrg, properties ) {

	const logger = signale.scope( 'addPropertiesToShader' );

	let shader = JSON.parse( stringify( shaderOrg ) );

	for ( const prop of properties ) {

		const key = prop.key;
		const value = prop.value;

		if ( key.name === 'vertexShader' || key.name === 'fragmentShader' ) {

			if ( value.type === 'MemberExpression' ) {

				shader[ key.name ].group = value.object.name;
				shader[ key.name ].name = value.property.name;

			} else {

				logger.debug( `> Unknown prop.value.type(shaders): ${value}` );

			}

		} else if ( key.name === 'uniforms' ) {

			if ( value.type === 'CallExpression' ) {

				shader.uniformsRefs = value.arguments[ 0 ].elements.reduce( ( all, element ) => {

					if ( element.type === 'MemberExpression' )
						/*
							All ShaderLibs entries look like 'UniformsUtils.merge( [ UniformsLib.lights, UniformsLib.fog, ... ] )'
							except for ShaderLib.physical since it references a previous ShaderLib entry (ShaderLib.standard.uniforms)
							it looks like 'UniformsUtils.merge( [ ShaderLib.standard.uniforms, ... ] )'.
							Hence the distinction between element.object.type being an Identifier ("Uniformslib") or an MemberExpression
							in and of itself ("ShaderLib.standard").
							This should be handled less hacky, but it ought to be enough for now.
						*/
						if ( element.object.type === 'MemberExpression' )
							all.push( ...shaderLibs[ 'standard' ].uniformsRefs ); // HACK
						else
							all.push( element.property.name );

					return all;

				}, [] );

			} else if ( value.type === 'ObjectExpression' ) {

				logger.debug( `Uniforms ObjectExpression, note sourceLocation and skip` );
				// console.log( util.inspect( value, false, 4, true ) );

			} else {

				logger.debug( `> Unknown prop.value.type(uniforms): ${value}` );

			}

		} else {

			logger.debug( `> Unknown prop.key.name: ${key.name}` );

		}

	}

	return shader;

}


function linkUpShader( shaderOrg ) {

	const logger = signale.scope( 'linkUpShader' );

	let shader = JSON.parse( stringify( shaderOrg ) );

	//
	// connect the shader to its respective chunks and uniforms
	//
	if ( shader.vertexShader.group === 'ShaderChunk' )
		shader.vertexShader.linked = shaderChunks[ shader.vertexShader.name ];
	else
		logger.error( `> Unknown vertexShader.group for '${shader.name}': ${shader.vertexShader.group}` );

	if ( shader.fragmentShader.group === 'ShaderChunk' )
		shader.fragmentShader.linked = shaderChunks[ shader.fragmentShader.name ];
	else
		logger.error( `> Unknown fragmentShader.group for '${shader.name}': ${shader.fragmentShader.group}` );


	//
	// normalize the uniforms references, sometimes they're an array and sometimes a string
	//
	if ( shader.uniformsRefs.length > 0 ) {

		shader.uniformsRefs = shader.uniformsRefs.map( u => {

			if ( typeof u === 'string' )
				return uniformsLibs[ u ];
			else
				return u;

		} );

	}

	return shader;

}


function addToDeps( { deps, path, location, code, name, count } ) {

	if ( deps.uniq.includes( path ) === false )
		deps.uniq.push( path );

	if ( typeof deps.lines[ path ] === 'undefined' )
		deps.lines[ path ] = [];

	deps.lines[ path ].push( { location, code, name, count } );

}


function isUniqueLine( lineEntry, idx, array ) {

	return idx === array.findIndex( lE =>
		lE.location.start.line === lineEntry.location.start.line &&
		lE.location.start.column === lineEntry.location.start.column &&
		lE.location.end.line === lineEntry.location.end.line &&
		lE.location.end.column === lineEntry.location.end.column &&
		lE.column === lineEntry.column &&
		lE.code === lineEntry.code &&
		lE.name === lineEntry.name
	);

}


function isUniqueUniform( uni, idx, uniforms ) {

	return idx === uniforms.findIndex( u =>
		u.name === uni.name &&
		u.start.line === uni.start.line &&
		u.start.column === uni.start.column &&
		u.end.line === uni.end.line &&
		u.end.column === uni.end.column
	);

}


function isUniqueShaderChunk( chunk, idx, chunks ) {

	return idx === chunks.findIndex( u =>
		u.name === chunk.name &&
		u.source === chunk.source &&
		u.start.line === chunk.start.line &&
		u.start.column === chunk.start.column &&
		u.end.line === chunk.end.line &&
		u.end.column === chunk.end.column
	);

}


function sortBySource( a, b ) {

	return a.source.localeCompare( b.name );
	// if ( a.source > b.source ) return 1;
	// else if ( a.source < b.source ) return - 1;
	// else return 0;

}


function sortByName( a, b ) {

	return a.name.localeCompare( b.name );
	// if ( a.name > b.name ) return 1;
	// else if ( a.name < b.name ) return - 1;
	// else return 0;

}


function processThreeJsCoverage( func, deps ) {

	const logger = signale.scope( 'processThreeJsCoverage' );

	if ( func.functionName === '' )
		return;

	for ( const range of func.ranges ) {

		//
		// First: sort out the non-visited ones
		//
		if ( range.count === 0 )
			continue;

		//
		// Second: Translate the character-based offset to a line-based one
		//
		const start = lines.locationForIndex( range.startOffset );

		//
		// Finally: Query the source map for the calculated line
		//
		const mapResult = sourceMapped.resolve( { line: start.line + 1, column: start.column } );

		// We found something
		if ( mapResult.sourceFile ) {

			if ( typeof astCache[ mapResult.sourceFile.path ] === 'undefined' ) {

				astCache[ mapResult.sourceFile.path ] = acorn.parse(
					fs.readFileSync( mapResult.sourceFile.path, 'utf8' ),
					{ locations: true, sourceType: "module", ecmaVersion: 9 }
				);

			}

			logger.debug( 'Found file:', mapResult.sourceFile.path );
			logger.debug( 'Looking for:', mapResult.sourceLine );
			logger.debug( 'Looking at index:', mapResult.sourceFile.text.indexOf( mapResult.sourceLine ) + mapResult.column );
			logger.debug( 'Originally:', range.startOffset );

			const vrAST = astCache[ mapResult.sourceFile.path ];

			logger.debug( 'vrAST is not undefined:', vrAST !== undefined );
			logger.debug( 'vrAST is not null:', vrAST !== null );

			// FIXME: findNodeAt seldom causes issues, findNodeAfter works - needs to be tested thou
			// node mass-import-both.js 2db634d94955e119d5a519d091cb57ebf52f55e3 4834fc7b289dccf713e94abda5852eebb8bae2f1
			let vrNode = walk.findNodeAt(
				vrAST,
				mapResult.sourceFile.text.indexOf( mapResult.sourceLine ) + mapResult.column
			);

			// *** TEST
			if ( vrNode === undefined )
				vrNode = walk.findNodeAfter( vrAST, mapResult.sourceFile.text.indexOf( mapResult.sourceLine ) + mapResult.column );

			// logger.debug( 'Lookup result:', vrNode );

			addToDeps( {
				code: mapResult.sourceLine.trim(),
				deps: deps,
				location: vrNode.node.loc,
				name: func.functionName,
				path: mapResult.sourceFile.path.replace( config.fileBase, '' ), // Get the normalized path
				count: range.count
			} );

		} else {

			logger.debug( `sourceMap missed? ${util.inspect( mapResult )}` );

		}

	}

}


function processOtherCoverage( func, script, deps ) {

	// const logger = signale.scope( 'processOtherCoverage' );

	if ( func.functionName === '' )
		return;

	for ( const range of func.ranges ) {

		//
		// First: sort out the non-visited ones
		//
		if ( range.count === 0 )
			continue;

		//
		// Second: Most likely something interesting -> get an AST
		//
		const filePath = script.url.replace( config.urlBase, config.fileBase );
		const fileContent = fs.readFileSync( filePath, 'utf8' );

		if ( typeof astCache[ filePath ] === 'undefined' )
			astCache[ filePath ] = acorn.parse( fileContent, { locations: true, sourceType: "module", ecmaVersion: 9 } );

		//
		// Third: Grab a matching node for its location
		//
		let node = walk.findNodeAt( astCache[ filePath ], range.startOffset, null, 'FunctionExpression' ) ||
			walk.findNodeAt( astCache[ filePath ], range.startOffset, null, 'FunctionDeclaration' ) ||
			walk.findNodeAt( astCache[ filePath ], range.startOffset, null );

		// *** TEST
		if ( node === undefined )
			node = walk.findNodeAfter( astCache[ filePath ], range.startOffset );
		// logger.debug( 'Lookup result:', node );

		//
		// Finally: Add the calculated line
		//
		addToDeps( {
			code: "-",
			deps: deps,
			location: node.node.loc,
			name: func.functionName,
			path: filePath.replace( config.fileBase, '' ), // Get the normalized path
			count: range.count
		} );

	}

}


function processShaderChunkAst( all, child ) {

	const logger = signale.scope( 'processShaderChunkAst' );

	if ( child.type !== 'ImportDeclaration' )
		return all;

	if ( child.specifiers.length > 1 ) {

		logger.error( `Too many specifiers in chunksFile (${child.specifiers.length}), aborting...` );
		process.exit( - 1 );

	}

	const name = child.specifiers[ 0 ].local.name;

	all[ name ] = {
		name: name,
		source: child.source.value,
		start: child.loc.start,
		end: child.loc.end

	};

	return all;

}


function processUniformsLibNodeProperties( all, property ) {

	const uniform = {
		name: property.key.name,
		start: property.loc.start,
		end: property.loc.end
	};

	all[ uniform.name ] = uniform;

	return all;

}


function cleanupDependencies( dependencies ) {

	const logger = signale.scope( 'cleanupDependencies' );

	// dirty, I know
	let deps = JSON.parse( JSON.stringify( dependencies ) );

	// filter duplicate code lines
	logger.debug( `Filtering duplicate code lines... ${Object.keys( deps.lines ).length} total` );
	for ( const path in deps.lines )
		deps.lines[ path ] = deps.lines[ path ].filter( isUniqueLine );

	// filter duplicate uniforms
	logger.debug( `Filtering duplicate uniforms...` );
	deps.uniforms = deps.uniforms.filter( isUniqueUniform );
	logger.debug( `Uniforms: ${deps.uniforms.map( u => u.name ).join( ', ' )}` );

	// filter duplicate shader chunks
	logger.debug( `Filtering duplicate shader chunks...` );
	deps.shaderChunks = deps.shaderChunks.filter( isUniqueShaderChunk );
	logger.debug( `Shader chunks: ${deps.shaderChunks.map( sc => sc.name ).join( ', ' )}` );

	// everything as deterministic as possible ( also see use of custom stringify )
	logger.debug( `Sorting code lines...` );
	for ( const key in deps.lines )
		deps.lines[ key ].sort( sortByName );

	logger.debug( `Sorting other stuff...` );
	logger.debug( `deps.uniq: ${deps.uniq.length}` );
	logger.debug( deps.uniq );
	deps.uniq.sort();

	logger.debug( `deps.external: ${deps.external.length}` );
	logger.debug( deps.external );
	deps.external.sort();

	logger.debug( `deps.shaderChunks: ${deps.shaderChunks.length}` );
	deps.shaderChunks.sort( sortBySource );

	return deps;

}


function loadShaderLibrary( shaderLibFile ) {

	const logger = signale.scope( 'loadShaderLibrary' );

	// https://astexplorer.net/#/gist/4a71649e75a2fd96dd03c4a3756a2a09/9061de91b9c03236f2ec53384142bf5414c94c4b
	const shaderLibSource = fs.readFileSync( shaderLibFile, 'utf8' );
	const shaderLibAst = acorn.parse( shaderLibSource, { locations: true, sourceType: 'module' } );
	const shaderLibNode = walk.findNodeAt( shaderLibAst, null, null, ( nodeType, node ) => {

		return nodeType === 'VariableDeclarator' && node.id.name === 'ShaderLib' && node.init.type === 'ObjectExpression';

	} );

	if ( ! shaderLibNode ) {

		logger.error( `Couldn't find shaderLibNode, aborting...` );
		process.exit( - 1 );

	}

	// TODO: refactor to prevent side effects.... some..how?
	for ( const entry of shaderLibNode.node.init.properties ) {

		let shader = processShaderLibName( entry );
		shader = addPropertiesToShader( shader, entry.value.properties );
		shader = linkUpShader( shader );

		shaderLibs[ shader.name ] = shader;

	}


	//
	// PhysicalNode is listed seperately in the source file because it references an earlier ShaderLib entry (standard)
	//
	const shaderPhysicalNode = walk.findNodeAt( shaderLibAst, null, null, ( nodeType, node ) => {

		return nodeType === 'AssignmentExpression' && node.left.object.name === 'ShaderLib' && node.left.property.name === 'physical';

	} );

	if ( ! shaderPhysicalNode ) {

		logger.error( `Couldn't find shaderPhysicalNode, aborting...` );
		process.exit( - 1 );

	}

	// we can't use processShaderLibName here
	let shader = {
		name: "physical",
		vertexShader: { group: undefined, name: undefined, linked: undefined },
		fragmentShader: { group: undefined, name: undefined, linked: undefined },
		uniformsRefs: [],
		start: shaderPhysicalNode.node.loc.start,
		end: shaderPhysicalNode.node.loc.end
	};

	shader = addPropertiesToShader( shader, shaderPhysicalNode.node.right.properties );

	shader = linkUpShader( shader );

	shaderLibs[ shader.name ] = shader;

	return shaderLibs;

}


module.exports = { init, search };


// simple CLI-fication
if ( require.main === module ) {

	if ( process.argv.length < 3 || process.argv.length > 5 ) {

		console.error( 'Invalid number of arguments' );

		console.log( `Usage: ${process.argv[ 0 ]} ${process.argv[ 1 ]} <URL or '-' for all examples> [<jobNumber> <totalJobs>]` );

		process.exit( - 1 );

	}

	// eslint-disable-next-line no-unused-vars
	const [ node, script, url, jobNumber, totalJobs ] = process.argv;

	singleMode = ( url === '-' ) ? false : true;

	try {

		( async() => {

			if ( ! singleMode ) {

				const exes = glob.sync( __dirname + '/../examples/webgl_*.html' )
					.filter( f => f.includes( 'offscreencanvas' ) === false )
					.map( f => f.replace( /^.*?\/examples/i, 'https://raw.githack.com/moraxy/three.js/automated/examples' ) );

				const zeroJobNumber = jobNumber - 1;

				const workload = exes.reduce( ( all, ex, i ) => {

					if ( i % totalJobs === zeroJobNumber )
						all.push( ex );

					return all;

				}, [] );

				console.log( 'length', workload.length, workload );
				init();
				await search( workload );

			} else {

				console.log( 'Init...' );

				init();

				console.log( `Working ${url}...` );

				await search( [ url ] );

			}

		} )();

	} catch ( err ) {

		console.error( 'The big one >', err );
		process.exit( - 1 );

	}

}
