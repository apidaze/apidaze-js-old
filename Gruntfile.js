module.exports = function(grunt) {

  var srcFiles = [
    'src/APIdaze.js',
    'src/Constants.js',
    'src/Utils.js',
    'src/Exceptions.js',
    'src/WebRTCAdapter.js',
    'src/EventTarget.js',
    'src/FlashAudio.js',
    'src/WebRTCAV.js',
    'src/ConferenceRoom.js',
    'src/CLIENT.js'
  ];

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      banner: '\
/*\n\
 * APIdaze version <%= pkg.version %>\n\
 * Copyright (c) 2013-<%= grunt.template.today("yyyy") %> Philippe Sultan http://apidaze.io\n\
 * Homepage: http://apidaze.io\n\
 */\n\n\n',
      footer: '\
\n\n\nwindow.APIdaze = APIdaze;\n\
}(window));\n\n'
    },
    clean: {
      files: ['dist/<%= pkg.name %>-<%= pkg.version %>.tmp.js']
    },
    concat: {
      tmpdist: {
        src: srcFiles,
        dest: 'dist/<%= pkg.name %>-<%= pkg.version %>.tmp.js',
        options: {
          banner: '<%= meta.banner %>',
          separator: '\n\n\n',
          footer: '<%= meta.footer %>',
          process: true
        },
        nonull: true
      },
      withlibs: {
        src: ['src/swfobject.js',srcFiles],
        dest: 'dist/<%= pkg.name %>-<%= pkg.version %>.js',
        options: {
          banner: '<%= meta.banner %>',
          separator: '\n\n\n',
          footer: '<%= meta.footer %>',
          process: true
        },
        nonull: true
      }
    },
    jshint: {
      gruntfile: {
        options: {
          jshintrc: '.jshintrc'
        },
        src: 'Gruntfile.js'
      },
      dist: {
        options: {
          jshintrc: 'dist/.jshintrc'
        },
        src: ['dist/<%= pkg.name %>-<%= pkg.version %>.tmp.js']
      },
    },
    qunit: {
      files: ['test/*.html']
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      dist: {
        src: 'dist/<%= pkg.name %>-<%= pkg.version %>.js',
        dest: 'dist/<%= pkg.name %>.min.js'
      }
    }
  });

  // Load the plugin that provides various tasks.
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // Default task(s).
  //grunt.registerTask('default', ['concat', 'jshint', 'qunit', 'clean', 'uglify']);
  grunt.registerTask('default', ['concat:tmpdist', 'jshint', 'concat:withlibs', 'clean', 'qunit', 'uglify']);

};
