/*

	Adapted from xunit-file, very scruffy
	https://github.com/peerigon/xunit-file

*/

const fs = require( "fs" );


class XUnitFile {

	constructor() {

		this.tests = [];
		this.fd = fs.openSync( __dirname + '/results.xml', 'w+', 0o755 );
		// this.fd = fs.createWriteStream( 'results.xml' );

		this.stats = {
			start: 0,
			duration: 0
		};

		this.title = '';

		this.activeTest = null;

	}

	startSuite( title ) {

		this.stats.start = new Date();

		this.title = title;

		console.log( '  ' + title + ' @ ' + this.stats.start.toLocaleString() );

	}

	startTest( url ) {

		this.activeTest = {
			url: url,
			start: new Date(),
			duration: 0,
			state: 'pending'
		};

		console.log( '  ◦ ' + url );

	}

	passTest() {

		if ( this.activeTest.state === 'passed' )
			return;

		this.activeTest.state = 'passed';
		this.activeTest.duration = new Date() - this.activeTest.start;

		console.log( '  + ' + this.activeTest.url );

		this.tests.push( this.activeTest );

		console.log( '>>', this.tests.length );

	}

	failTest() {

		if ( this.activeTest.state === 'failed' )
			return;

		this.activeTest.state = 'failed';
		this.activeTest.duration = new Date() - this.activeTest.start;

		console.log( '  - ' + this.activeTest.url );

		this.tests.push( this.activeTest );

	}

	endSuite() {

		var timestampStr = ( new Date() ).toISOString().split( '.', 1 )[ 0 ];

		this.stats.duration = new Date() - this.stats.start;

		const failures = this.tests.filter( t => t.state === 'failed' ).length;
		const passes = this.tests.filter( t => t.state === 'passed' ).length;

		appendLine( this.fd, tag( 'testsuite', {
			name: 'typeProfiler tests',
			tests: this.tests.length,
			failures: failures,
			errors: failures,
			skipped: this.tests.length - failures - passes,
			timestamp: timestampStr,
			time: this.stats.duration / 1000
		}, false ) );

		// if ( process.env.XUNIT_LOG_ENV ) {

		// 	logProperties( fd );

		// }

		this.tests.forEach( test => {

			writeTest( this.fd, test );

		} );

		appendLine( this.fd, '</testsuite>' );

		fs.closeSync( this.fd );
		// this.fd.close();

	}

}


/**
 * Writes a list of process and environment variables to the <properties> section in the XML.
 */
// function logProperties( fd ) {

// 	var attrs = new Object();
// 	var properties = "\n";

// 	properties += logProperty( 'process.arch', process.arch );
// 	properties += logProperty( 'process.platform', process.platform );
// 	properties += logProperty( 'process.memoryUsage', objectToString( process.memoryUsage() ) );
// 	properties += logProperty( 'process.cwd', process.cwd() );
// 	properties += logProperty( 'process.execPath', process.execPath );
// 	properties += logProperty( 'process.execArgv', process.execArgv.join( ' ' ) );
// 	properties += logProperty( 'process.argv', process.argv.join( ' ' ) );
// 	properties += logProperty( 'process.version', process.version.replace( '"', '' ) );
// 	properties += logProperty( 'process.versions', objectToString( process.versions ) );
// 	properties += logProperty( 'process.env.PATH', process.env.PATH );
// 	properties += logProperty( 'process.env.NODE_PATH', process.env.NODE_PATH );
// 	properties += logProperty( 'process.env.SUITE_NAME', process.env.SUITE_NAME );
// 	properties += logProperty( 'process.env.XUNIT_FILE', process.env.XUNIT_FILE );
// 	properties += logProperty( 'process.env.LOG_XUNIT', process.env.LOG_XUNIT );

// 	appendLine( fd, tag( 'properties', {}, false, properties ) );

// }

/**
 * Formats a single property value.
 */

// function logProperty( name, value ) {

// 	return '  ' + tag( 'property', { name: name, value: value }, true ) + '\n';

// }

/**
 * Simple utility to convert a flat Object to a readable string.
 */

// function objectToString( obj ) {

// 	var arrayString = '';

// 	if ( obj ) {

// 		for ( var prop in obj ) {

// 			var propValue = '' + obj[ prop ];
// 			if ( arrayString.length > 0 ) {

//     	  arrayString += ', ';

// 			}
// 			arrayString += prop + ": '" + propValue.replace( "'", "\\'" ) + "'";

// 		}

// 	}
// 	return '[ ' + arrayString + ']';

// }


/**
 * Output tag for the given `test.`
 */

function writeTest( fd, test ) {

	// TODO:
	const attrs = {
		classname: 'url request',
		name: test.url,
		time: test.duration ? test.duration / 1000 : 0
	};

	if ( test.state === 'failed' ) {

		const err = test.err || { message: 'failed', stack: '' };
		appendLine( fd, tag( 'testcase', attrs, false, tag( 'failure', { message: escapeHtml( err.message ) }, false, cdata( err.stack ) ) ) );

	} /* else if ( test.state === 'skipped' ) {

		delete attrs.time;
		appendLine( fd, tag( 'testcase', attrs, false, tag( 'skipped', {}, true ) ) );

	}  */else if ( test.state === 'passed' ) {

		appendLine( fd, tag( 'testcase', attrs, false, tag( 'success', {}, true ) ) );

	} else {

		appendLine( fd, tag( 'testcase', attrs, true ) );

	}

}

/**
 * HTML tag helper.
 */

function tag( name, attrs, close, content ) {

	var end = close ? '/>' : '>',
		pairs = [];

	for ( var key in attrs )
		pairs.push( key + '="' + escapeHtml( attrs[ key ] ) + '"' );

	let result = '<' + name + ( pairs.length ? ' ' + pairs.join( ' ' ) : '' ) + end;

	if ( content )
		result += content + '</' + name + end;

	return result;

}

/**
 * Return cdata escaped CDATA `str`.
 */

function cdata( str ) {

	return '<![CDATA[' + escapeHtml( str ) + ']]>';

}

function appendLine( fd, line ) {

	// if ( process.env.LOG_XUNIT ) {

	// console.log( line );

	// }
	fs.writeSync( fd, line + "\n", null, 'utf8' );
	// fd.write( line, 'utf8' );

}


/*!
 * escape-html
 * Copyright(c) 2012-2013 TJ Holowaychuk
 * Copyright(c) 2015 Andreas Lubbe
 * Copyright(c) 2015 Tiancheng "Timothy" Gu
 * MIT Licensed
 */

// *** slight rewrite for browser-use

/**
 * Module variables.
 * @private
 */

var matchHtmlRegExp = /["'&<>]/;

/**
 * Escape special characters in the given string of text.
 *
 * @param  {string} string The string to escape for inserting into HTML
 * @return {string}
 * @public
 */

function escapeHtml( string ) {

	var str = '' + string;
	var match = matchHtmlRegExp.exec( str );

	if ( ! match ) {

		return str;

	}

	var escape;
	var html = '';
	var index = 0;
	var lastIndex = 0;

	for ( index = match.index; index < str.length; index ++ ) {

		switch ( str.charCodeAt( index ) ) {

			case 34: // "
				escape = '&quot;';
				break;
			case 38: // &
				escape = '&amp;';
				break;
			case 39: // '
				escape = '&#39;';
				break;
			case 60: // <
				escape = '&lt;';
				break;
			case 62: // >
				escape = '&gt;';
				break;
			default:
				continue;

		}

		if ( lastIndex !== index ) {

			html += str.substring( lastIndex, index );

		}

		lastIndex = index + 1;
		html += escape;

	}

	return lastIndex !== index
		? html + str.substring( lastIndex, index )
		: html;

}


module.exports = XUnitFile;
