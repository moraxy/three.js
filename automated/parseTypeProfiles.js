const fs = require( 'fs' );
const path = require( 'path' );
const glob = require( 'glob' );
const tsmorph = require( 'ts-morph' );
const getSource = require( 'get-source' );
const stringify = require( 'json-stable-stringify' );
const linesAndCols = require( 'lines-and-columns' );

const logger = require( 'signale' ).scope( 'parseTypeProfiles' );
const cacheLogger = require( 'signale' ).scope( 'cacheLogger' );

/*

	Formerly 'test_test_tsmorph-als-JS-manipulator.js'

	Takes a collection of typeProfiles and turns them into
	a JSON with correct references to the functions and parameters
	in src/ files.
	Showing that e.g. in 'example_foo' the function 'Vector3.add'
	was called with parameters of type Vector3, undefined and number.

	This is the data generator behind the 'TypeSearch' function.

*/

const project = new tsmorph.Project( { compilerOptions: { removeComments: false, allowJs: true } } );

/**
 * @type {Object.<string,string>}
 */
const contentCache = {};

/**
 * @type {Object.<string, tsmorph.SourceFile>}
*/
const objectCache = {};

/**
 * @type {Object.<string, Object.<number,tsmorph.Node>>}
*/
const nodeCache = {};

/**
 * @type {Map.<any, string>}
 */
const nameCache = new Map();


const functionsCache = new Map();

const startLineNumberCache = new Map();
const startLineNumberCache2 = new Map(); // for includeJsDoc === true // TODO: necessary?
const linesAndColsCache = new Map();
const getSourceCache = new Map();


/**
 * @type {Object.<string, (tsmorph.FunctionDeclaration|tsmorph.FunctionExpression)[]>}
 */
const exampleCalls = {};


function TypeManager() {

	this.cache = new Map();

	this.addType = function ( name ) {

		if ( this.cache.has( name ) === false )
			this.cache.set( name, this.cache.size );

		return this.cache.get( name );

	};

	this.listTypes = function () {

		return [ ...this.cache.keys() ];

	};

}


class ParameterManager {

	constructor( typeManager ) {

		this.paramCache = new Map();
		this.scopedCache = {};

		this.typeManager = typeManager;

	}

	/**
	 * @param {string} scopeName Filename where this was found (i.e. typeResults-example_webgl_...)
	 * @param {(tsmorph.FunctionDeclaration|tsmorph.FunctionExpression)} functionNode
	 * @param {{ index: number, name: string, pos: object, types: string[] }} parameterObj
	 */
	addParameter( scopeName, functionNode, parameterObj ) {

		// clone it since we need to cut out types
		const paramWithoutTypes = Object.assign( {}, parameterObj );
		delete paramWithoutTypes.types;

		// global cache for all params without their types
		// stringify is an ugly solution, but creating objects dynamically kinda renders Map's advantage null
		const stringifiedParamWithoutTypes = stringify( paramWithoutTypes ); // no need to call 'stringify' thrice
		if ( this.paramCache.has( stringifiedParamWithoutTypes ) === false )
			this.paramCache.set( stringifiedParamWithoutTypes, this.paramCache.size );

		const paramId = this.paramCache.get( stringifiedParamWithoutTypes );


		// handle types seperately
		const types = parameterObj.types.map( type => this.typeManager.addType( type ) );


		// init a new scoped cache if necessary
		if ( typeof this.scopedCache[ scopeName ] === 'undefined' )
			this.scopedCache[ scopeName ] = new Map();

		// by scoping it, every profile/example can have its own types while still
		// sharing the parameters themselves with other runs (and hopefully save space)
		if ( this.scopedCache[ scopeName ].has( functionNode ) === false ) {

			// now merge the globally cached parameters with its local types
			const finalObj = { p: paramId, t: types };

			const newParamList = new Array( parameterObj.index + 1 );
			newParamList[ parameterObj.index ] = finalObj;

			this.scopedCache[ scopeName ].set( functionNode, newParamList );

			// console.log( 'Added to new functionNode:', newParamList );

		} else {

			const preExistingParams = this.scopedCache[ scopeName ].get( functionNode );

			// console.log( 'Already existing params:', preExistingParams );

			if ( typeof preExistingParams[ parameterObj.index ] !== 'undefined' ) {

				// our parameter already exists, just add new types
				const newTypes = types.filter( t => preExistingParams[ parameterObj.index ].t.indexOf( t ) === - 1 );
				preExistingParams[ parameterObj.index ].t.push( ...newTypes );

			} else {

				// the functionNode is already known, but this particular parameter is still missing
				const finalObj = { p: paramId, t: types };

				// insert into preExisting
				preExistingParams[ parameterObj.index ] = finalObj;

			}

			// console.log( 'All done:', preExistingParams );

			this.scopedCache[ scopeName ].set( functionNode, preExistingParams );

		}

	}

	/**
	 * @param {string} scopeName
	 * @param {(tsmorph.FunctionDeclaration|tsmorph.FunctionExpression)} functionNode
	 * @param {number} index
	 * @param {string} type
	 * @returns {boolean}
	 */
	addTypeToIndex( scopeName, functionNode, index, type ) {

		if ( typeof this.scopedCache[ scopeName ] === 'undefined' )
			return false;

		if ( this.scopedCache[ scopeName ].has( functionNode ) === false )
			return false;

		const params = this.scopedCache[ scopeName ].get( functionNode );

		if ( typeof params[ index ] === 'undefined' )
			return false;

		const typeId = this.typeManager.addType( type );

		if ( params[ index ].t.indexOf( typeId ) === - 1 )
			params[ index ].t.push( typeId );

		this.scopedCache[ scopeName ].set( functionNode, params );

		return true;

	}

	listTypes() {

		return this.typeManager.listTypes();

	}

	listScopedParameters( scopeName, functionNode ) {

		if ( typeof this.scopedCache[ scopeName ] === 'undefined' )
			return;

		return this.scopedCache[ scopeName ].get( functionNode );

	}

	listGlobalParameter( paramId ) {

		return this.listGlobalParameters()[ paramId ];

	}

	listGlobalParameters() {

		return [ ...this.paramCache.keys() ].map( p => JSON.parse( p ) );

	}

}

const TypeMngr = new TypeManager();
const ParamMngr = new ParameterManager( TypeMngr );
const RetvalMngr = new ParameterManager( TypeMngr );


for ( const profileFile of glob.sync( __dirname + '/typeProfile-*_*.json' ) ) {

	console.log( { profileFile } );

	exampleCalls[ profileFile ] = [];

	const profile = JSON.parse( fs.readFileSync( profileFile, 'utf8' ) );

	const ignores = [ 'draco_wasm_wrapper', 'draco_decoder', 'jsm/lib', '.min.', 'libs/ammo.js' ];
	const files = profile.results.result
		.filter( r => r.url.indexOf( 'https://raw.githack.com/moraxy/three.js/' ) !== - 1 )
		.filter( r => r.url.endsWith( '.html' ) === false )								// no html files
		.filter( r => ignores.every( pattern => r.url.indexOf( pattern ) === - 1 ) );	// all ignores are missing from the url


	for ( const results of files ) {

		const sourceFile = results.url.replace( 'https://raw.githack.com/moraxy/three.js/automated', __dirname + '/../' );

		console.log( { sourceFile } );

		const sourceCode = contentCache[ sourceFile ] || fs.readFileSync( sourceFile, 'utf8' );
		if ( contentCache[ sourceFile ] )
			cacheLogger.debug( 'contentCache hit' );
		else
			contentCache[ sourceFile ] = sourceCode;

		const source = objectCache[ sourceFile ] || project.createSourceFile( sourceFile, sourceCode, { overwrite: true } );
		if ( objectCache[ sourceFile ] )
			cacheLogger.debug( 'objectCache hit' );
		else
			objectCache[ sourceFile ] = source;

		const nodeCacheForThisFile = nodeCache[ sourceFile ] || {};
		if ( nodeCache[ sourceFile ] )
			cacheLogger.debug( 'nodeCache hit' );
		else
			nodeCache[ sourceFile ] = nodeCacheForThisFile;


		for ( const entry of results.entries ) {

			logger.debug( { entry } );

			//
			// get the node this entry references
			//
			const node = nodeCacheForThisFile[ entry.offset ] || source.getDescendantAtPos( entry.offset );
			if ( nodeCacheForThisFile[ entry.offset ] )
				cacheLogger.debug( 'nodeCacheForThisFile hit', entry.offset );
			else
				nodeCacheForThisFile[ entry.offset ] = node;

			if ( ! node ) {

				console.error( 'Node not found:', sourceFile, entry.offset, entry.types.map( x => x.name ).join( ' | ' ) );
				continue;

			}


			//
			// test if it's a node we can use
			// (sometimes they refer to useless ones like commas or semicolons)
			//
			const nodeKind = node.getKind();

			if ( nodeKind !== tsmorph.SyntaxKind.CloseBraceToken && nodeKind !== tsmorph.SyntaxKind.Identifier ) {

				console.error( 'Node neither Identifier nor CloseBraceToken, rather:', node.getKindName() );
				continue;

			}


			/**
			 * @type {tsmorph.FunctionDeclaration|tsmorph.FunctionExpression}
			 */
			const parentparent = node.getParent().getParent();
			const parentparentKind = parentparent.getKind();


			//
			// type profile for a function parameter
			//
			if ( node.getKind() === tsmorph.SyntaxKind.Identifier ) {

				// check to see if we've already encountered this FunctionNode
				const existingParams = ParamMngr.listScopedParameters( profileFile, parentparent );
				const sigParams = parentparent.getSignature().getParameters();

				if ( ! existingParams || sigParams.length !== existingParams.length ) {

					// either we haven't or we have a different number of parameters saved for it
					const params = sigParams.map( ( param, idx ) => ( {
						name: param.getEscapedName(),
						types: [],
						index: idx,
						pos: param.getDeclarations().map( decl => ( {
							pos: decl.getPos()
						} ) )
					} ) );

					// add them
					params.forEach( p => ParamMngr.addParameter( profileFile, parentparent, p ) );

				}

				const match = sigParams.findIndex( x => x.getEscapedName() === node.getText() );
				if ( match !== - 1 ) {

					entry.types.forEach( ( { name } ) => {

						const success = ParamMngr.addTypeToIndex( profileFile, parentparent, match, name );

						if ( ! success )
							logger.error( 'added type to index', match, 'named', name, '---->', success );
						else
							logger.debug( 'added type to index', match, 'named', name, '---->', success );

					} );

				} else {

					logger.error( node.getText(), 'failed:', match );

				}

			}


			//
			// type profile for a return value
			//
			if ( node.getKind() === tsmorph.SyntaxKind.CloseBraceToken ) {

				if ( entry.types.length > 0 ) {

					// a bit hacky maybe
					RetvalMngr.addParameter( profileFile, parentparent, {
						index: 0,
						name: 'return',
						pos: null,
						types: entry.types.map( type => type.name )
					} );

				}

			}


			//
			// early bailout
			//
			if ( functionsCache.has( parentparent ) ) {

				const func = functionsCache.get( parentparent );

				if ( func.name ) {

					cacheLogger.debug( `Cache hit: ${func.name}` );

					if ( exampleCalls[ profileFile ].indexOf( parentparent ) === - 1 ) {

						exampleCalls[ profileFile ].push( parentparent );
						logger.debug( `Added ${func.name} hit to ${profileFile}'s functions: ${exampleCalls[ profileFile ].length}` );

					}

					continue;

				} else {

					console.error( 'functionsCache has a hit but no name?' );

					process.exit( - 3 );

				}

			}


			//
			// more bailout
			//
			if ( node.getKind() === tsmorph.SyntaxKind.CloseBraceToken )
				continue;


			if ( parentparentKind === tsmorph.SyntaxKind.FunctionDeclaration ) {

				/**
				 * @type {tsmorph.FunctionDeclaration}
				 */
				const func = parentparent;

				const name = nameCache.get( func ) || func.getName();
				nameCache.set( func, name );

				logger.debug( `function declaration: function ${name} -> <RETURN VALUE>` );

				if ( startLineNumberCache.has( func ) === false )
					startLineNumberCache.set( func, func.getStartLineNumber( false ) );
				const startLineNumber = startLineNumberCache.get( func );

				const funcObj = functionsCache.get( func ) || {
					name, sourceFile,
					start: func.getPos(),
					startRaw: func.getStart( false ),
					startLineNumber
				};

				functionsCache.set( func, funcObj );

				exampleCalls[ profileFile ].push( func );

				logger.debug( `Added ${funcObj.name} to ${profileFile}'s functions: ${exampleCalls[ profileFile ].length}` );

			} else if ( parentparentKind === tsmorph.SyntaxKind.FunctionExpression ) {

				/**
				 * @type {tsmorph.FunctionExpression}
				 */
				const func = parentparent;

				const name = getNameFromFuncExpr( func );

				let funcObj = functionsCache.get( func );

				if ( funcObj === undefined ) {

					logger.debug( `Creating funcObj for ${name}-${sourceFile}` );

					if ( startLineNumberCache2.has( func ) === false )
						startLineNumberCache2.set( func, func.getStartLineNumber( true ) );
					const startLineNumber = startLineNumberCache2.get( func );

					funcObj = {
						name, sourceFile,
						start: func.getPos(),
						startRaw: func.getStart(),
						startLineNumber
					};

				}

				functionsCache.set( func, funcObj );

				exampleCalls[ profileFile ].push( func );

				logger.debug( `Added ${funcObj.name} Node to ${profileFile}'s functions: ${exampleCalls[ profileFile ].length}` );

			}

		}

	}

}


const collection = {
	functions: new Map(),
	files: [],
	lines: [],
	originals: new Map()
};


const resultsNewDict = { results: [] };

for ( const profileFile of Object.keys( exampleCalls ) ) {

	for ( const funcNode of exampleCalls[ profileFile ] ) {

		const funcObj = functionsCache.get( funcNode );

		if ( ! funcObj )
			throw new Error( 'No cache hit for funcNode' );

		const { startRaw, sourceFile, startLineNumber } = funcObj;


		const params = ParamMngr.listScopedParameters( profileFile, funcNode );
		const retvals = RetvalMngr.listScopedParameters( profileFile, funcNode )[ 0 ].t;


		if ( typeof contentCache[ sourceFile + '-split' ] === 'undefined' )
			contentCache[ sourceFile + '-split' ] = contentCache[ sourceFile ].split( /\n/g );

		const line = contentCache[ sourceFile + '-split' ][ startLineNumber - 1 ];
		if ( collection.lines.indexOf( line ) === - 1 )
			collection.lines.push( line );


		if ( linesAndColsCache.has( sourceFile ) === false )
			linesAndColsCache.set( sourceFile, new linesAndCols.default( contentCache[ sourceFile ] ) );
		const lcf = linesAndColsCache.get( sourceFile );


		if ( getSourceCache.has( sourceFile ) === false )
			getSourceCache.set( sourceFile, getSource( sourceFile ) );
		const sourceMapped = getSourceCache.get( sourceFile );


		const location = lcf.locationForIndex( startRaw );
		const mapResult = sourceMapped.resolve( { line: location.line + 1, column: location.column } );

		const pathRelative = path.relative( __dirname + '/../', mapResult.sourceFile.path );
		if ( collection.files.indexOf( pathRelative ) === - 1 )
			collection.files.push( pathRelative );


		const original = {
			line: mapResult.line,
			column: mapResult.column,
			file: collection.files.indexOf( pathRelative )
		};

		const stringifiedOriginal = stringify( original );
		if ( collection.originals.has( stringifiedOriginal ) === false )
			collection.originals.set( stringifiedOriginal, collection.originals.size );


		const newFuncObj = {
			name: funcObj.name,
			start: funcObj.start,
			startLineNumber
		};

		const stringifiedNewFuncObj = stringify( newFuncObj );
		if ( collection.functions.has( stringifiedNewFuncObj ) === false )
			collection.functions.set( stringifiedNewFuncObj, collection.functions.size );


		// logger.debug( `In ${profileFile} we call ${newFuncObj.name || '-anonymous-'} with...` );
		// logger.debug( `ScopedParams for '${funcObj.name}': ${JSON.stringify( ParamMngr.listScopedParameters( profileFile, funcNode ) )}` );
		// logger.debug( `Retval for '${funcObj.name}': ${RetvalMngr.listScopedParameters( profileFile, funcNode )[ 0 ].t.join( '|' )}` );

		// sort param types, cosmetics only
		// params.sort( ( a, b ) => Math.min( a.t ) - Math.min( b.t ) );
		params.forEach( ( p ) => p.t.sort() );

		const obj = {
			file: profileFile.replace( /^.*?typeProfile-(.*?)\.json$/, "$1" ),
			func: collection.functions.get( stringifiedNewFuncObj ),
			params: params,
			retval: retvals,
			line: collection.lines.indexOf( line ),
			original: collection.originals.get( stringifiedOriginal )
		};

		const existingEntry = resultsNewDict.results.find( result => {

			return result.func === obj.func &&
				stringify( result.params ) === stringify( obj.params ) &&
				stringify( result.retval ) === stringify( obj.retval ) &&
				result.line === obj.line &&
				result.original === obj.original;

		} );
		if ( existingEntry ) {

			// console.log( 'appending' );
			if ( Array.isArray( existingEntry.file ) )
				existingEntry.file.push( obj.file );
			else
				existingEntry.file = [ existingEntry.file, obj.file ];

		} else {

			resultsNewDict.results.push( obj );

		}

	}

}


resultsNewDict[ '_lines' ] = collection.lines;
resultsNewDict[ '_files' ] = collection.files;
resultsNewDict[ '_originals' ] = [ ...collection.originals.keys() ].map( o => JSON.parse( o ) );
resultsNewDict[ '_functions' ] = [ ...collection.functions.keys() ].map( f => JSON.parse( f ) );
resultsNewDict[ '_params' ] = ParamMngr.listGlobalParameters();
resultsNewDict[ '_types' ] = TypeMngr.listTypes();


fs.writeFileSync( __dirname + '/typeProfile-results.json', stringify( resultsNewDict ), 'utf8' );


function getNameFromFuncExpr( func ) {

	const ANONYMOUS_FUNCTIONNAME = '-anonymous-';

	const parentparentparentKind = func.getParent().getKind();

	let name, description, identifierNode = func;

	if ( func.getName() ) {

		name = nameCache.get( func ) || func.getName();

		description = 'function expression';

	} else if ( parentparentparentKind === tsmorph.SyntaxKind.VariableDeclaration ) {

		/**
		 * @type {tsmorph.VariableDeclaration}
		 */
		identifierNode = func.getParent();

		name = nameCache.get( identifierNode ) || ( ( typeof identifierNode[ 'getName' ] !== 'undefined' ) ? identifierNode.getName() : '-unknown name-' );

		description = 'function expression with variable declaration';

	} else if ( parentparentparentKind === tsmorph.SyntaxKind.BinaryExpression ) {

		// https://astexplorer.net/#/gist/a3e7a83e1bf992ce610792760f34cfea/43452418abc4fa049f483881824dd921f8a51a19

		/**
		 * @type {tsmorph.BinaryExpression}
		 */
		identifierNode = func.getParent();

		name = nameCache.get( identifierNode ) || identifierNode.getLeft().getText();

		description = 'function expression with binary expression';

	} else if ( parentparentparentKind === tsmorph.SyntaxKind.PropertyAssignment ) {

		// https://astexplorer.net/#/gist/274fdfc14ae3c475a939bbc00ae69ab7/c1183492f5303176d213e132297a6a955b832ace

		/**
		 * @type {tsmorph.PropertyAssignment}
		 */
		identifierNode = func.getParent();

		name = nameCache.get( identifierNode ) || identifierNode.getName();

		description = 'function expression with property assignment';

	} else if ( parentparentparentKind === tsmorph.SyntaxKind.ReturnStatement ) {

		name = nameCache.get( func ) || func.getName() || ANONYMOUS_FUNCTIONNAME;

		description = 'function expression after return statement';

	} else if ( parentparentparentKind === tsmorph.SyntaxKind.NewExpression ) {

		/**
		 * @type {tsmorph.NewExpression}
		 */
		identifierNode = func.getParent();

		name = nameCache.get( identifierNode ) || identifierNode.getExpression().getText();

		description = 'function expression after new expression';

	} else if ( parentparentparentKind === tsmorph.SyntaxKind.CallExpression ) {

		if ( func.getParent().getParent().getKind() === tsmorph.SyntaxKind.BinaryExpression ) {

			/**
			 * @type {tsmorph.BinaryExpression}
			 */
			identifierNode = func.getParent().getParent();

			name = nameCache.get( identifierNode ) || identifierNode.getLeft().getText();

			description = 'function expression with call expression and binary expression';

		} else if ( func.getParent().getParent().getKind() === tsmorph.SyntaxKind.VariableDeclaration ) {

			/**
			 * @type {tsmorph.VariableDeclaration}
			 */
			identifierNode = func.getParent().getParent();

			name = nameCache.get( identifierNode ) || identifierNode.getName();

			description = 'function expression with call expression and variable declaration';

		} else if ( func.getParent().getParent().getParent().getKind() === tsmorph.SyntaxKind.VariableDeclaration ) {

			/**
			 * @type {tsmorph.VariableDeclaration}
			 */
			identifierNode = func.getParent().getParent().getParent();

			name = nameCache.get( identifierNode ) || identifierNode.getName();

			description = 'function expression with call expression and distant variable declaration';

		} else if ( func.getParent().getKind() === tsmorph.SyntaxKind.CallExpression ) {

			/**
			 * @type {tsmorph.CallExpression}
			 */
			identifierNode = func.getParent();

			if ( identifierNode.getExpression() === func ) {

				name = ANONYMOUS_FUNCTIONNAME;

				description = 'function expression with call expression and no-name function';

			} else {

				name = nameCache.get( func ) || func.getName() || ANONYMOUS_FUNCTIONNAME;

				description = 'function expression with call expression and expression';

			}

		} else {

			console.log( 'NOTHING:', func.getParent().getKindName() );

		}

	} else if ( parentparentparentKind === tsmorph.SyntaxKind.ParenthesizedExpression ) {

		identifierNode = func;

		name = nameCache.get( identifierNode ) || identifierNode.getName() || ANONYMOUS_FUNCTIONNAME;

		description = 'function expression with parenthesized expression';

	} else if ( parentparentparentKind === tsmorph.SyntaxKind.PropertyAccessExpression ) {

		identifierNode = func;

		name = nameCache.get( identifierNode ) || identifierNode.getName() || ANONYMOUS_FUNCTIONNAME;

		description = 'function expression with property access expression';

	} else {

		console.log( 'NEITHER:', func.getParent().getKindName() );

	}


	if ( name !== undefined ) {

		name = name.replace( 'this.', '' );
		nameCache.set( identifierNode, name );
		logger.debug( `${description}: function ${name}` );

		return name;

	} else {

		throw new Error( 'name not found' );

	}

}
