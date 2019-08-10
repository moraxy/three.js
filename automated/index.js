/* eslint-disable @typescript-eslint/no-unused-vars */
const fs = require( 'fs' );
const puppeteer = require( 'puppeteer' );
const stringify = require( 'json-stable-stringify' );
const glob = require( 'glob' );
const Promise = require( 'bluebird' );
const signale = require( 'signale' );
const writeFilePromise = Promise.promisify( fs.writeFile );

signale.config( {
	displayTimestamp: true
} );

/*

	type profiling for 3js examples

*/

process.on( 'unhandledRejection', ( reason/* , p */ ) => {

	console.error( 'unhandledRejection' );
	throw reason;

} );

process.on( 'uncaughtException', error => {

	console.error( 'uncaughtException' );
	console.error( error );
	// process.exit( 1 );

	if ( singleMode ) {

		console.error( 'singleMode' );

		process.exit( - 1 );

	} else {

		const exes = glob.sync( __dirname + '/../examples/webgl_*.html' )
			.filter( f => f.includes( 'offscreencanvas' ) === false )
			.map( f => f.replace( /^.*?\/examples/i, 'https://raw.githack.com/moraxy/three.js/automated/examples' ) );

		const shortExes = exes.slice( exes.indexOf( currentUrl ) + 1 );
		console.log( { shortExes } );
		init();
		search( shortExes );

	}

} );

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

	puppeteerOptions: [ '--mute-audio' ]

};

var config;

const seedRandom = fs.readFileSync( __dirname + '/seedrandom.min.js', 'utf8' );
const timekeeper = fs.readFileSync( __dirname + '/timekeeper.min.js', 'utf8' );

let currentUrl; // evil hack
let singleMode; // same evil hack

var profilerRunning = false;

var modifiedTHREE;


/**
 * @param {puppeteer.Page} page
 * @param {Promise} promiseNetworkHasBeenIdle Resolves when the network has been idle for TIMEOUT ms
 */
function setupPage( page ) {

	const logger = signale.scope( 'setupPage' );

	logger.info( 'Setting up page...' );

	let setups = [
		//
		// basics
		//
		page.setViewport( { width: 320, height: 240 } ),

		//
		// tracking shims
		//
		page.evaluateOnNewDocument( seedRandom + timekeeper )

	];


	return Promise.all( setups );

}


function init( configOverrides = {} ) {

	const logger = signale.scope( 'init' );

	// apply overrides to default values
	config = Object.assign( defaultConfig, configOverrides );

	logger.debug( `Modify script at ${config.fileBase + config.mainScriptPath}` );
	modifiedTHREE = fs.readFileSync( config.fileBase + config.mainScriptPath, 'utf8' ) + ';debugger;';

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

							console.error( '------', err, '------' );

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
	await client.send( 'Performance.enable' );
	client.addListener( 'Debugger.paused', async ( ) => {

		if ( profilerRunning === false ) {

			profilerRunning = true;

			await client.send( 'Profiler.enable' );
			await client.send( 'Profiler.startTypeProfile' );
			logger.debug( 'Started profiler' );

			client.removeAllListeners( 'Debugger.paused' );

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
		.then( () => {

			//
			// goto url, wait for network idle, collect tracked data, signal we're finished
			//
			logger.debug( `Goto ${url}` );

			currentUrl = url;

			return page.goto( url, { timeout: 120000, waitUntil: 'load' } )
				.then( () => {

					logger.debug( 'Arrived' );

					return promiseNetworkHasBeenIdle
						.then( async () => {

							logger.debug( 'Network has been idle for long enough, working...' );

							await page.removeAllListeners( 'request' );

							logger.debug( 'All listeners removed' );

							// await page.waitFor( 4000, { timeout: 60 * 1000 } );

							profilerRunning = false;

							return true;

						} )
						.then( () => {

							logger.debug( 'Profiler.takeTypeProfile' );

							return Promise.any( [
								client.send( 'Profiler.takeTypeProfile' ),
								new Promise( x => x ).delay( 60000, false )
							] )
								.then( result => {

									if ( ! result )
										logger.error( 'Promise.delay triggered' );

									logger.debug( 'Time to stop' );

									return client.send( 'Profiler.stopTypeProfile' )
										.then( () => logger.debug( 'TypeProfiler stopped' ) )
										.then( () => result );

								} )
								.then( result => {

									logger.debug( `typeProfile.result.length: ${result.result.length}` );

									return writeFilePromise(
										`typeProfile-${crudelyEscapedUrl}`,
										stringify( { file: page.url(), results: result } ),
										'utf8'
									);

								} )
								.catch( err => logger.error( `takeTypeProfile failed: ${err}` ) );

						} )
						.catch( err => {

							console.error( 'ERR Profiler.takeTypeProfile >', err );
							process.exit( - 1 );

						} );

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

		if ( ! singleMode ) {

			const exes = glob.sync( __dirname + '/../examples/webgl_*.html' )
				.filter( f => f.includes( 'offscreencanvas' ) === false )
				.map( f => f.replace( /^.*?\/examples/i, 'https://raw.githack.com/moraxy/three.js/automated/examples' ) );

			const chunkSize = Math.ceil( exes.length / totalJobs ); // err on one too many instead of one too few

			const workload = exes.slice( ( jobNumber - 1 ) * chunkSize, ( jobNumber - 1 ) * chunkSize + chunkSize );

			console.log( 'chunkSize', chunkSize, 'length', workload.length, workload );
			init();
			search( workload );

		} else {

			console.log( 'Init...' );

			init();

			console.log( `Working ${url}...` );

			search( [ url ] );

		}

	} catch ( err ) {

		console.error( 'The big one >', err );
		process.exit( - 1 );

	}

}
