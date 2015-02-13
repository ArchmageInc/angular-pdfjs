(function () {
    'use strict';

    var del         =   require('del'),
        gulp        =   require('gulp'),
        connect     =   require('gulp-connect'),
        jscs        =   require('gulp-jscs'),
        jshint      =   require('gulp-jshint'),
        ngAnnotate  =   require('gulp-ng-annotate'),
        open        =   require('gulp-open'),
        uglify      =   require('gulp-uglifyjs'),
        stylish     =   require('jshint-stylish'),
        karma       =   require('karma').server,
        bowerFiles  =   require('main-bower-files'),
        wiredep     =   require('wiredep'),
        path        =   require('path'),
        mergeStream =   require('merge-stream');

    gulp.task('build', ['clean', 'bower', 'js'], function (cb) {
        cb();
    });
    gulp.task('clean', ['clean:build'], function (cb) {
        cb();
    });
    gulp.task('clean:build', function(cb) {
        del([
            'dist'
        ], cb);
    });

    
    gulp.task('js', ['js:compress', 'js:wiredep'], function (cb) {
        cb();
    });

    gulp.task('js:compress', ['clean'], function () {
        var exportFiles = [
            '!**/*-test.js',
            'src/**/*.js'
        ];
        var annotated = gulp.src(exportFiles)
            .pipe(ngAnnotate());

        var compressed = annotated
            .pipe(uglify('angular-pdfjs.min.js', {
                outSourceMap: true,
                sourceRoot:   './'
            }))
            .pipe(gulp.dest('dist'))
            .pipe(gulp.dest('example/js/lib'));;

        var uncompressed = annotated
            .pipe(gulp.dest('example/js/lib/src'));


        return mergeStream(compressed, uncompressed);
    });
    gulp.task('js:wiredep', ['clean', 'bower'], function () {
        return gulp.src(
            'example/index.html'
        )
        .pipe(wiredep.stream({
            fileTypes: {
                html: {
                    replace: {
                        js: function (filePath) {
                            return '<script src="js/lib/' + path.basename(filePath) + '"></script>';
                        },
                        css: function (filePath) {
                            return '<link rel="stylesheet" href="css/' + path.basename(filePath) + '" />';
                        }
                    }
                }
            }
        }))
        .pipe(gulp.dest('example'));
    });

    gulp.task('bower', ['clean'], function () {
        return gulp.src(
            bowerFiles()
        )
        .pipe(gulp.dest('example/js/lib'));
    });

    gulp.task('test:js', ['test:jshint', 'test:jscs', 'test:unit'], function (cb) {
        cb();
    });
    gulp.task('test:unit', function(cb) {
        var files   =   wiredep({
            devDependencies: true
        }).js.concat([
            'src/**/*.js'
        ]);
        karma.start({
            configFile: __dirname + '/karma.conf.js',
            files:      files
        }, function () {
            cb();
        });
    });
    gulp.task('test:jshint', function () {
        return gulp.src(
            'src/**/*.js'
        )
        .pipe(jshint())
        .pipe(jshint.reporter(stylish));
    });

    gulp.task('test:jscs', function () {
        return gulp.src(
            'src/**/*.js'
        )
        .pipe(jscs());
    });
    gulp.task('connect', ['build'], function () {
        connect.server({
            port:       8000,
            root:       'example',
            livereload: true
        });
    });
    gulp.task('watch', function (cb) {
        return gulp.watch([
            'src/**/*'
        ], ['build', 'test:js', 'reload']);

    });

    gulp.task('reload', ['build'], function () {
        return gulp.src('')
            .pipe(connect.reload());
    });

    gulp.task('open', ['connect'], function () {
        return gulp.src('example/index.html')
            .pipe(open('', {
                url: 'http://localhost:8000'
        }));
    });

    gulp.task('tdd', ['build', 'open', 'watch'], function (cb) {
        cb();
    });
}());
