/* eslint-disable no-unused-vars */
const fs = require( 'fs' );
const puppeteer = require( 'puppeteer' );
const linesAndCols = require( 'lines-and-columns' );
const glob = require( 'glob' );
const stringify = require( 'json-stable-stringify' );
const Promise = require( 'bluebird' );
const writeFilePromise = Promise.promisify( fs.writeFile );

const signale = require( 'signale' );
signale.config( {
	displayTimestamp: true
} );


/*

		+ stats collection

*/

process.on( 'unhandledRejection', ( reason/* , p */ ) => {

	console.error( 'unhandledRejection' );
	throw reason;

} );

process.on( 'uncaughtException', error => {

	console.error( 'uncaughtException' );
	console.error( error );
	process.exit( - 1 );

} );


const TIMEOUT = 4000;

const defaultConfig = {

	urlBase: 'https://raw.githack.com/moraxy/three.js/automated/examples/',
	fileBase: __dirname + '/../',

	mainScriptFilename: 'three.module.js',
	mainScriptPath: 'build/three.module.js',

	examplesFilenameRegex: /(examples\/(?:webgl|webaudio|webvr|css.*?|misc)_.*?\.html)$/,

	puppeteerOptions: [ '--mute-audio' ]

};

var config;

const seedRandom = fs.readFileSync( __dirname + '/seedrandom.min.js', 'utf8' );
const timekeeper = fs.readFileSync( __dirname + '/timekeeper.min.js', 'utf8' );

var source;
var lines;
let singleMode; // same evil hack

var profilerRunning = false;

var modifiedTHREE;
var pageStart;


/**
 * @param {puppeteer.Page} page
 * @param {Promise} promiseNetworkHasBeenIdle Resolves when the network has been idle for TIMEOUT ms
 */
function setupPage( page ) {

	const logger = signale.scope( 'setupPage' );

	logger.info( 'Setting up page...' );

	let loggedRequests = [];

	let setups = [
	//
	// basics
	//
		page.setViewport( { width: 320, height: 240 } ),


		//
		// tracking shims
		//
		page.evaluateOnNewDocument( seedRandom + timekeeper ),		// determinism
		// page.evaluateOnNewDocument( trackStats, 300 /* fpsLimit */ ),	// inject stats-tracking code


	];


	return Promise.all( setups )
		.then( () => {

			console.log( 'intial setup done, setting listeners...' );

			//
			// Listeners
			//
			page.on( 'console', msg => {

				logger.debug( `Console ${msg.text()}` );

			} );

			page.on( 'pageerror', msg => {

				logger.debug( `PageError ${msg}` );

			} );

			page.on( 'request', req => {

				logger.debug( `Request ${req.method()} ${req.url()}` );

				loggedRequests.push( req.url() );

			} );

			console.log( 'listeners done' );

			return { loggedRequests };

		} );

}


function init( configOverrides = {} ) {

	const logger = signale.scope( 'init' );

	// apply overrides to default values
	config = Object.assign( defaultConfig, configOverrides );

	source = fs.readFileSync( config.fileBase + config.mainScriptPath, 'utf8' );
	lines = new linesAndCols.default( source );

	logger.debug( `Modify script at ${config.fileBase + config.mainScriptPath}` );
	modifiedTHREE = fs.readFileSync( config.fileBase + config.mainScriptPath, 'utf8' )
	+ `
	window.RENDERER = WebGLRenderer.prototype;
	window.VECTOR3 = Vector3.prototype;
	window.VECS = 0;

	debugger;`;

}


/**
* @param {string[]} urls
*/
function search( urls = [] ) {

	const logger = signale.scope( 'search' );

	if ( Array.isArray( urls ) && urls.length > 0 ) {

		// return puppeteer.launch( { headless: false, devtools: true, dumpio: true, args: [ '--use-gl=swiftshader', ...config.puppeteerOptions ] } )
		return puppeteer.launch( { headless: true, devtools: false, dumpio: true, args: [ '--use-gl=swiftshader', ...config.puppeteerOptions ] } )
		// return puppeteer.launch( { headless: true, devtools: false, dumpio: true, args: [ '--use-gl=egl', '--enable-gpu', ...config.puppeteerOptions ] } )
		// return puppeteer.launch( { headless: false, devtools: false, dumpio: true, args: [ '--use-gl=egl', '--enable-gpu', ...config.puppeteerOptions ] } )
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

	return true;

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

		} else if ( config.examplesFilenameRegex.test( interceptedRequest.url() ) ) {

			// or maybe our example file, again we answer with a modified version

			const match = interceptedRequest.url().match( config.examplesFilenameRegex );
			const content = fs.readFileSync( config.fileBase + match[ 0 ], 'utf8' );

			await interceptedRequest.respond( {
				status: 200,
				contentType: 'text/html',
				body: content.replace( '</head>', '<script lang="text/javascript">' + trackStats( 300, true ) + '</script></head>' )
			} );

			console.log( 'EXAMPLE INTERCEPTED' );

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
	let rendererDone = false;
	const client = await page.target().createCDPSession();
	await client.send( 'Runtime.enable' );
	await client.send( 'Debugger.enable' );
	await client.send( 'Performance.enable' );
	client.addListener( 'Debugger.paused', async ( event ) => {

		if ( profilerRunning === false ) {

			profilerRunning = true;

			// client.removeAllListeners( 'Debugger.paused' );

			// again, all based on hope here
			const threeScriptId = event.callFrames[ 0 ].location.scriptId;

			const threeLocation = lines.locationForIndex( source.indexOf( 'function WebGLRenderer( parameters ) {' ) );

			await client.send( 'Debugger.continueToLocation', { location: { scriptId: threeScriptId, lineNumber: threeLocation.line + 1 } } );

		} else if ( rendererDone === false ) {

			rendererDone = true;

			logger.debug( 'Profiler is already running, time to handle WebGLRenderer' );

			const threeCallFrameId = event.callFrames[ 0 ].callFrameId; // Hope.

			await client.send( 'Debugger.evaluateOnCallFrame', { callFrameId: threeCallFrameId, expression: 'window.RENDERERInstance = this;' } );

			await client.send( 'Debugger.resume' );

		}

	} );


	const metrics = [];
	const metricsStart = process.hrtime();
	const metricsTimer = setInterval( async () => {

		metrics.push( ( await client.send( 'Performance.getMetrics' ) ).metrics );
		// await client.send( 'Performance.disable' );

	}, 250 );


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
		.then( ( ) => {

			//
			// goto url, wait for network idle, collect tracked data, signal we're finished
			//
			logger.debug( `Goto ${url}` );

			return page.goto( url, { timeout: 120000, waitUntil: 'load' } )
				.then( () => {

					logger.debug( 'Arrived' );

					pageStart = Date.now();

					return promiseNetworkHasBeenIdle
						.then( async () => {

							logger.debug( 'Network has been idle for long enough, working...' );

							clearInterval( metricsTimer );

							await page.removeAllListeners( 'request' );

							logger.debug( 'All listeners removed' );

							try {

								await page.waitFor( ( fpsLimit, dynamicWaitLimit ) =>
									window._sniffed_frames >= fpsLimit ||
									window._sniff_started + dynamicWaitLimit <= performance.now(),
								{ timeout: 120 * 1000 }, 300 /* fpsLimit */, 15 * 1000 /* dynamicWaitLimit */
								);

								// emergency shut-off valve, otherwise we're collecting stats till page.close() worst-case
								// also we can still reconstruct the "real" value by subtracting fpsLimit from it
								await page.evaluate( ( fpsLimit ) => {

									window._sniffed_frames += fpsLimit;

								}, 300 /* fpsLimit */ );

							} catch ( e ) {

								console.error( `Stats timed out` );

								let sniffed_duration = await page.evaluate( () => performance.now() - window._sniff_started );
								let sniffed_frames = await page.evaluate( () => window._sniffed_frames );
								let sniff_started = await page.evaluate( () => window._sniff_started );

								console.error(
									`Stats > Duration ${sniffed_duration}, Frames ${sniffed_frames}, Start ${sniff_started}`
								);

								process.exit( - 1 );

							}

							let sniffed_duration = await page.evaluate( () => performance.now() - window._sniff_started );
							let sniffed_frames = await page.evaluate( () => window._sniffed_frames );
							let sniff_started = await page.evaluate( () => window._sniff_started );

							console.log(
								'Stats "%s" > Sniffed frames: %i%s   Sniff started: %f   Sniffed duration: %f',
								page.url(), sniffed_frames, ( sniffed_frames > 300 ) ? `(=${sniffed_frames - 300})` : '', ( sniff_started / 1000 ).toFixed( 4 ), ( sniffed_duration / 1000 ).toFixed( 4 )
							);

							return true;

						} )
						.then( async () => {

							profilerRunning = false;

							const sniffed_duration = await page.evaluate( () => performance.now() - window._sniff_started );
							const sniffed_frames = await page.evaluate( () => window._sniffed_frames );
							const sniff_started = await page.evaluate( () => window._sniff_started );
							const stats = await page.evaluate( () => window._sniff );

							const metricsHashed = metrics.map( metricArray => {

								const hashed = {};
								for ( const metric of metricArray )
									hashed[ metric.name ] = metric.value;

								return hashed;

							} );

							await writeFilePromise(
								`statsResults-${crudelyEscapedUrl}`,
								stringify( {
									file: page.url(),
									results: stats,
									pageStart: pageStart,
									now: Date.now(),
									nowHr: process.hrtime(),
									sniff: {
										duration: sniffed_duration,
										frames: sniffed_frames,
										started: sniff_started
									},
									metrics: metricsHashed,
									metricsStart
								} ),
								'utf8'
							);

							return true;

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


function trackStats( fpsLimit, hijackDrawFunctions = true ) {

	// adapted from rStats.js

	const preamble = `window._sniffed_frames = 0;
	window._sniff_started = 0;

	window._sniff = {
		three: {
			memoryInfo: [],
			renderInfo: [],
			programs: []
		},
		webgl: {
			drawElements: [], drawArrays: [], bindTexture: [], useProgram: [],
			glFaces: [], glVertices: [], glPoints: []
		}
	};`;


	const drawFunctions = ( hijackDrawFunctions !== true ) ? '' : `
	function hijack( func, callback ) {

			return function () {

				callback.apply( this, arguments );
				func.apply( this, arguments );

			};

		}

		WebGLRenderingContext.prototype.drawArrays = hijack( WebGLRenderingContext.prototype.drawArrays, function () {

			if ( window._sniffed_frames < ${fpsLimit} ) {

				const ts = performance.now();

				window._sniff.webgl.drawArrays.push( ts );

				if ( arguments[ 0 ] == this.POINTS )
					window._sniff.webgl.glPoints.push( { ts: ts, v: arguments[ 2 ] } );
				else
					window._sniff.webgl.glVertices.push( { ts: ts, v: arguments[ 2 ] } );

			}

		} );

		WebGLRenderingContext.prototype.drawElements = hijack( WebGLRenderingContext.prototype.drawElements, function () {

			if ( window._sniffed_frames < ${fpsLimit} ) {

				const ts = performance.now();

				window._sniff.webgl.drawElements.push( ts );

				window._sniff.webgl.glFaces.push( { ts: ts, v: arguments[ 1 ] / 3 } );
				window._sniff.webgl.glVertices.push( { ts: ts, v: arguments[ 1 ] } );

			}

		} );

		WebGLRenderingContext.prototype.useProgram = hijack( WebGLRenderingContext.prototype.useProgram, function () {

			if ( window._sniffed_frames < ${fpsLimit} ) {

				const ts = performance.now();

				window._sniff.webgl.useProgram.push( ts );

			}

		} );

		WebGLRenderingContext.prototype.bindTexture = hijack( WebGLRenderingContext.prototype.bindTexture, function () {

			if ( window._sniffed_frames < ${fpsLimit} ) {

				const ts = performance.now();

				window._sniff.webgl.bindTexture.push( ts );

			}

		} );`;

	const loop = `
	requestAnimationFrame( function loop2( ) {

		if ( window._sniff_started === 0 )
			window._sniff_started = performance.now();

		if ( window._sniffed_frames < ${fpsLimit} ) {

			if ( typeof window.RENDERERInstance !== 'undefined' && typeof window.RENDERERInstance.info !== 'undefined' ) {

				const now = performance.now();

				window._sniff.three.memoryInfo.push( { ts: now, v: JSON.stringify( window.RENDERERInstance.info.memory ) } );
				window._sniff.three.renderInfo.push( { ts: now, v: JSON.stringify( window.RENDERERInstance.info.render ) } );
				window._sniff.three.programs.push( { ts: now, v: window.RENDERERInstance.info.programs.length } );

			}

			window._sniffed_frames ++;

		}

		requestAnimationFrame( loop2 );

	} );`;

	return preamble + drawFunctions + loop;

}


module.exports = { init, search };


// simple CLI-fication
if ( require.main === module ) {

	if ( process.argv.length < 3 || process.argv.length > 5 ) {

		console.error( 'Invalid number of arguments' );

		console.log( `Usage: ${process.argv[ 0 ]} ${process.argv[ 1 ]} <URL or '-' for all examples> [<jobNumber> <totalJobs>]` );

		process.exit( - 1 );

	}


	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [ node, script, url, jobNumber, totalJobs ] = process.argv;

	singleMode = ( url === '-' ) ? false : true;

	try {

		( async() => {

			if ( ! singleMode ) {

				const exes = glob.sync( __dirname + '/../examples/webgl_*.html' )
					.filter( f => f.includes( 'offscreencanvas' ) === false )
					.map( f => f.replace( /^.*?\/examples/i, 'https://raw.githack.com/moraxy/three.js/automated/examples' ) );

				const chunkSize = Math.ceil( exes.length / totalJobs ); // err on one too many instead of one too few

				const workload = exes.slice( ( jobNumber - 1 ) * chunkSize, ( jobNumber - 1 ) * chunkSize + chunkSize );

				console.log( 'chunkSize', chunkSize, 'length', workload.length, workload );
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

