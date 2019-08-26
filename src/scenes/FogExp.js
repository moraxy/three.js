/**
 * @author mrdoob / http://mrdoob.com/
 * @author alteredq / http://alteredqualia.com/
 * @author EliasHasle / http://eliashasle.github.io/
 */

import { Color } from '../math/Color.js';

function FogExp( color, density ) {

	this.name = '';

	this.color = new Color( color );
	this.density = ( density !== undefined ) ? density : 0.015;

}

Object.assign( FogExp.prototype, {

	isFogExp: true,

	clone: function () {

		return new FogExp( this.color, this.density );

	},

	toJSON: function ( /* meta */ ) {

		return {
			type: 'FogExp',
			color: this.color.getHex(),
			density: this.density
		};

	}

} );

export { FogExp };
