module.exports = function(grunt) {
    "use strict";
    
    // Project configuration.
    grunt.initConfig({
            pkg: grunt.file.readJSON('package.json'),
            simplemocha: {
                options: {
                    globals: ['expect'],
                    timeout: 4500,
                    ignoreLeaks: false,
                    ui: 'bdd',
                    reporter: 'spec'
                },
                all: { src: ['test/**/*_spec.js'] },
            },
            jshint: {
                options: {
                    // http://www.jshint.com/docs/options/
                    //"asi": true,      // allow missing semicolons
                    "curly": true,    // require braces
                    //"eqnull": true,   // ignore ==null
                    "forin": true,    // require property filtering in "for in" loops
                    "immed": true,    // require immediate functions to be wrapped in ( )
                    "nonbsp": true,   // warn on unexpected whitespace breaking chars
                    "strict": true, // commented out for now as it causes 100s of warnings, but want to get there eventually
                    "loopfunc": true, // allow functions to be defined in loops
                    //"sub": true       // don't warn that foo['bar'] should be written as foo.bar
                },
                all: [
                    'Gruntfile.js',
                    'coap/**/*.js',
                ],
                
                tests: {
                    files: {
                        src: ['test/**/*.js']
                    },
                    options: {
                        "expr": true,
			"strict": false
                    }
                }
                
            }
    });
    
    grunt.loadNpmTasks('grunt-simple-mocha');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    
    grunt.registerTask('default', ['jshint:all','jshint:tests','simplemocha:all']);
};
