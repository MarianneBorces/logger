'use strict';

const _       = require( 'lodash' );
const winston = require( 'winston' );
const os      = require( 'os' );

// Logstash plugin
require( 'winston-logstash' );

// Logger placeholder
let logger;

function setConfigs ( options ) {
	options = options || {};

	// By default, file and console logs are disabled.
	let defaultEnabledOptions = {
		'file' : {
			'enabled' : []
		},

		'console' : {
			'enabled' : []
		},

		'logstash' : {
			'enabled' : []
		}
	};

	const defaultOptions = {
		'file' : {
			'logstash' : true,
			'maxsize'  : 15000000
		},

		'additional' : {
			'hostname'   : os.hostname(),
			'dockerhost' : process.env.DOCKER_HOST || 'undefined'
		}
	};

	// This should take care of the condition that whenever a user
	// explicitly adds an option for a log stream it will run in
	// any environment.
	_.defaults( options, defaultEnabledOptions );

	// Add additional options
	_.defaultsDeep( options, defaultOptions );

	return options;
}

function setTransports ( options ) {
	const env = process.env;
	let nodenv;

	if ( env.NODE_ENV ) {
		nodenv = env.NODE_ENV.toLowerCase();
	} else {
		nodenv = null;
	}

	// Log output stream config -> Winston transport module name
	let modes = {
		'file'     : 'File',
		'console'  : 'Console',
		'logstash' : 'Logstash'
	};

	const transports = _.map( Object.keys( modes ), function ( out ) {
		const mode = modes[ out ];

		// By default, if an out stream config is present but
		// `enabled` option is not set it will run in any environment.
		if ( !options[ out ].enabled ) {
			/* eslint no-extra-parens:0 */
			return new ( winston.transports[ mode ] )( options[ out ] );
		}

		if ( options[ out ].enabled.indexOf( nodenv ) !== -1 ) {
			/* eslint no-extra-parens:0 */
			return new ( winston.transports[ mode ] )( options[ out ] );
		}
	} );

	function stripUndefined ( array ) {
		return _.filter( array, function ( item ) {
			/* eslint no-extra-parens:0 */
			return ( item !== undefined );
		} );
	}

	return stripUndefined( transports );
}

// Returns a modified Winston logger instance
function getLogger ( options ) {
	const transports = setTransports( options );

	logger = new winston.Logger( {
		transports
	} );

	logger.log = function () {
		if ( transports.length < 1 ) {
			logger.emit( 'error', new Error( 'No transports defined. Cannot produce logs.' ) );
		}

		let args = Array.prototype.slice.call( arguments );

		// If append the additional data
		let lastItem = args[ args.length - 1 ];

		if ( typeof lastItem === 'object' && !Array.isArray( lastItem ) ) {
			lastItem = _.defaultsDeep( lastItem, options.additional );
		} else {
			args.push( options.additional );
		}

		winston.Logger.prototype.log.apply( this, args );
	};

	// Log to console for transport level errors
	transports.forEach( function ( transport ) {
		transport.on( 'error', function ( error ) {
			console.log( error );
		} );
	} );

	return logger;
}

module.exports = function ( options ) {
	if ( !logger ) {
		options = setConfigs( options );

		logger = getLogger( options );
	}

	return logger;
};
