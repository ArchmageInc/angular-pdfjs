/* global PDFJS, _, angular, jasmine, expect */

(function () {
    'use strict';

    function mockPromise(data, fail) {
        return {
            then: function (sFn, eFn) {
                if (fail) {
                    eFn('Mock error');
                } else {
                    setTimeout(function () {
                        sFn(data);
                    }, 100);
                    return mockPromise(data);
                }
            },
            catch: function (eFn) {
                if (fail) {
                    eFn('Mock error');
                }
            },
            destroy: jasmine.createSpy('destroy').and.callFake(_.partial(mockPromise, null, false))
        };
    }

    function flush(inj) {
        jasmine.clock().tick(101);
        try {
            inj.$timeout.flush();
        } catch (ex) {}
        jasmine.clock().tick(101);
    }

    function skipToTheEnd(inj) {
        _.times(3, _.partial(flush, inj));
    }

    function mockDocument(totalPages, page, fail) {
        page = page || mockPage();
        return {
            getPage: jasmine.createSpy('getPage').and.returnValue(mockPromise(page, fail)),
            numPages: totalPages
        };
    }

    function mockPage(viewport, fail) {
        viewport = viewport || mockPageViewport();
        return {
            getViewport: jasmine.createSpy('getViewport').and.returnValue(viewport),
            render: jasmine.createSpy('renderPage').and.returnValue(mockPromise(null, fail))
        };
    }

    function mockPageViewport(viewBox, scale, rotation, offsetX, offsetY) {
        return _.defaults({
            viewBox: viewBox,
            scale: scale,
            rotation: rotation,
            offsetX: offsetX,
            offsetY: offsetY,
            width: 1000,
            height: 1000
        }, {
            viewBox: [0, 0, 1000, 1000],
            scale: 1,
            rotation: 0,
            offsetX: 0,
            offsetY: 0,
            width: 1000,
            height: 1000
        });
    }

    function mockPDFJS(document, fail) {
        return {
            VERBOSITY_LEVELS: {
                warnings: 1,
                errors: 2
            },
            PageViewport: function () {
                _.extend(this, mockPageViewport.apply(this, arguments));
            },
            getDocument: jasmine.createSpy().and.returnValue(mockPromise(document, fail))
        };
    }

    function init(angularMocks, pdfjsMocks) {
        angularMocks = _.extend({}, angularMocks);
        pdfjsMocks = _.extend({}, pdfjsMocks);
        var inj = {
            pdfjs: {}
        };

        _.defaults(angularMocks, {

        });

        inj.pdfjs.viewport = pdfjsMocks.viewport || mockPageViewport();
        inj.pdfjs.page = pdfjsMocks.page || mockPage(inj.pdfjs.viewport);
        inj.pdfjs.document = pdfjsMocks.document || mockDocument(3, inj.pdfjs.page);
        inj.pdfjs.PDFJS = pdfjsMocks.PDFJS || mockPDFJS(inj.pdfjs.document);

        Object.defineProperty(window, 'PDFJS', {
            value: inj.pdfjs.PDFJS
        });

        module('angular-pdfjs', function ($provide) {
            _.forEach(angularMocks, function (mock, mockName) {
                $provide.constant(mockName, mock);
                inj[mockName] = mock;
            });
        });

        inject(function ($compile, $rootScope, $timeout) {
            _.defaults(inj, {
                $scope: $rootScope.$new(),
                $compile: $compile,
                $timeout: $timeout
            });
        });

        return inj;
    }

    function initDirective(html, inj, data) {
        var $el = inj.$compile(html)(_.merge(inj.$scope, data));
        inj.$scope.$digest();
        return $el;
    }

    var directive = _.partial(initDirective, '<div pdf-viewer pdf-url="pdfUrl" id="my-viewer"></div>');

    function plainSetup() {
        var inj = init();

        inj.$el = directive(inj, {
            pdfUrl: 'mockUrl'
        });
        skipToTheEnd(inj);
        return inj;
    }

    describe('angular-pdfjs directive > ', function () {
        beforeEach(function () {
            jasmine.clock().install();
        });
        afterEach(function () {
            jasmine.clock().uninstall();
        });
        
        describe('Base functionality > ', function () {
            it('attaches the controller to the scope based on the id', function () {
                var inj = init(),
                    $el = directive(inj);

                expect(inj.$scope.myViewer).toBe($el.controller('pdfViewer'));
            });

            it('Does not error with no ID attribute', function () {
                var inj = init();

                expect(_.partial(initDirective, '<div pdf-viewer pdf-url="pdfUrl"></div>', inj)).not.toThrow();
            });
            it('Sets the PDF Document as the result of the PDFJS promise', function () {
                var inj = plainSetup();

                expect(PDFJS.getDocument).toHaveBeenCalledWith('mockUrl');
                expect(inj.$scope.myViewer.getDocument()).toEqual(inj.pdfjs.document);
            });
            describe('Loading > ', function () {
                it('Exposes a loading indicator', function () {
                    var inj = init({}, {
                            PDFJS: mockPDFJS(mockDocument(1, mockPage(mockPageViewport())), false)
                        });

                    directive(inj);

                    expect(inj.$scope.myViewer.loading).toBeNull();

                    inj.$scope.myViewer.loadDocument('mockUrl');

                    expect(inj.$scope.myViewer.loading).not.toBeNull();

                    skipToTheEnd(inj);

                    expect(inj.$scope.myViewer.loading).toBeNull();

                });
                it('Rejects promise on document load error', function () {
                    var inj = init({}, {
                            PDFJS: mockPDFJS(mockDocument(1, mockPage(mockPageViewport())), true)
                        }),
                        mockCatch = jasmine.createSpy('mockCatch');

                    directive(inj);

                    inj.$scope.myViewer.loadDocument('fakeUrl').then(_.noop, mockCatch);
                    expect(mockCatch).not.toHaveBeenCalled();

                    flush(inj);
                    
                    expect(mockCatch).toHaveBeenCalled();

                    inj.$scope.myViewer.loadDocument('fakeUrl').catch(mockCatch);
                    
                    flush(inj);

                    expect(mockCatch.calls.count()).toBe(2);

                    expect(inj.$scope.myViewer.loading).toBeNull();

                });
                it('Rejects promise on page load error', function () {
                    var inj = init({}, {
                            PDFJS: mockPDFJS(mockDocument(1, mockPage(mockPageViewport()), true), false)
                        }),
                        mockCatch = jasmine.createSpy('mockCatch');

                    directive(inj);

                    inj.$scope.myViewer.loadDocument('fakeUrl').then(_.noop, mockCatch);
                    expect(mockCatch).not.toHaveBeenCalled();

                    flush(inj);

                    expect(mockCatch).toHaveBeenCalled();

                    expect(inj.$scope.myViewer.loading).toBeNull();

                });
                it('Rejects promise on page render error', function () {
                    var inj = init({}, {
                            PDFJS: mockPDFJS(mockDocument(1, mockPage(mockPageViewport(), true), false), false)
                        }),
                        mockCatch = jasmine.createSpy('mockCatch');

                    directive(inj);

                    inj.$scope.myViewer.loadDocument('fakeUrl').then(_.noop, mockCatch);
                    expect(mockCatch).not.toHaveBeenCalled();

                    flush(inj);
                    flush(inj);

                    expect(mockCatch).toHaveBeenCalled();

                    inj.$scope.myViewer.loadDocument('fakeUrl').catch(mockCatch);

                    flush(inj);
                    flush(inj);

                    expect(mockCatch.calls.count()).toBe(2);

                    expect(inj.$scope.myViewer.loading).toBeNull();
                });
                it('Allows canceling a load request', function () {
                    var inj = init({}, {
                            PDFJS: mockPDFJS(mockDocument(1, mockPage(mockPageViewport())), false)
                        }),
                        postCancel = jasmine.createSpy('postCancel').and.callFake(function () {
                            flush(inj);
                            expect(inj.$scope.myViewer.loading).toBeNull();
                            
                        });

                    directive(inj);

                    inj.$scope.myViewer.loadDocument('mockUrl');

                    inj.$scope.myViewer.cancelLoad().then(postCancel);
                    flush(inj);

                    expect(postCancel).toHaveBeenCalled();

                    expect(inj.$scope.myViewer.loading).toBeNull();
                });
                it('Does nothing if already loaded and cancel attempted', function () {
                    var inj = init({}, {
                            PDFJS: mockPDFJS(mockDocument(1, mockPage(mockPageViewport())), false)
                        }),
                        postCancel = jasmine.createSpy('postCancel').and.callFake(function () {
                            flush(inj);
                            expect(inj.$scope.myViewer.loading).toBeNull();
                        });

                    directive(inj);

                    inj.$scope.myViewer.loadDocument('mockUrl');
                    flush(inj);

                    expect(inj.$scope.myViewer.loading).toBeNull();

                    inj.$scope.myViewer.cancelLoad().then(postCancel);
                    flush(inj);

                    expect(postCancel).toHaveBeenCalled();

                    expect(inj.$scope.myViewer.loading).toBeNull();
                });
            });
            
        });
        describe('Page Navigation > ', function () {
            
            it('Goes to the next page', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                expect(inj.pdfjs.document.getPage.calls.count()).toBe(1);

                viewer.nextPage();

                flush(inj);

                expect(inj.pdfjs.document.getPage.calls.count()).toBe(2);
                expect(viewer.page).toBe(2);
                expect(inj.pdfjs.document.getPage.calls.mostRecent().args[0]).toBe(2);

                expect(inj.$scope.myViewer.loading).toBeNull();
            });
            it('Goes to a maximum page', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.page = 4;

                flush(inj);

                expect(inj.pdfjs.document.getPage.calls.count()).toBe(2);
                expect(viewer.page).toBe(3);

                expect(inj.$scope.myViewer.loading).toBeNull();
            });
            it('Goes to a minimum of page 1', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.previousPage();

                flush(inj);

                expect(inj.pdfjs.document.getPage.calls.count()).toBe(1);
                expect(viewer.page).toBe(1);

                expect(inj.$scope.myViewer.loading).toBeNull();
            });
            it('Will not render if page isNaN', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.page = 'not a number';

                flush(inj);

                expect(inj.pdfjs.document.getPage.calls.count()).toBe(1);

                expect(inj.$scope.myViewer.loading).toBeNull();
            });
            it('Exposes the total number of pages', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                expect(viewer.total).toEqual(inj.pdfjs.document.numPages);

                expect(inj.$scope.myViewer.loading).toBeNull();
                
            });
            it('Does not allow the setting of total pages', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.total = 100;

                flush(inj);
                
                expect(viewer.total).toEqual(inj.pdfjs.document.numPages);

                expect(inj.$scope.myViewer.loading).toBeNull();
            });
        });
        describe('Page Rendering > ', function () {
            describe('Zooming > ', function () {
                describe('Zoom in > ', function () {
                    it('Zooms in', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomIn();

                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBeGreaterThan(1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Zooms in with params', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomIn(4);

                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBe(5);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
                describe('Zoom out > ', function () {
                    it('Zooms out', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomOut();

                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBeLessThan(1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });

                    it('Zooms out to a minimum', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomOut(4);

                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBe(1);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
                describe('Bound zoom > ', function () {
                    it('Zooms when modifying bound zoom', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoom = 100;

                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBe(100);
                        expect(viewer.zoom).toEqual(100);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
            });
            describe('Panning > ', function () {
                describe('Pan Right > ', function () {
                    it('Does not pan right beyond page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panRight(1);

                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panRight, 'a')).not.toThrow();

                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Pans right within page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        flush(inj);
                        
                        viewer.panRight(1);

                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        
                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
                describe('Pan Left > ', function () {
                    it('Does not pan left beyond page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panLeft(1);

                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panLeft, 'a')).not.toThrow();

                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Pans left within page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        flush(inj);

                        viewer.panRight(2);
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-2);
                        
                        viewer.panLeft(1);
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        
                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
                describe('Pan Up > ', function () {
                    it('Does not pan up beyond page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panUp(1);
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(function () {
                            viewer.panUp('a');
                            flush(inj);
                        }).not.toThrow();

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Pans up within page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        flush(inj);

                        viewer.panDown(2);
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);

                        viewer.panUp(1);
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
                describe('Pan Down > ', function () {
                    it('Does not pan down beyond page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panDown(1);
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(function () {
                            viewer.panDown('a');
                            flush(inj);
                        }).not.toThrow();

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Pans up within page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        flush(inj);

                        viewer.panDown(2);
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
                describe('Pan To > ', function () {
                    it('Does not error with invalid pan arguments', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(function () {
                            viewer.panTo('a', 'b');
                            flush(inj);
                        }).not.toThrow();

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
                describe('Bound offsets > ', function () {

                    it('Pans when modifying bound offset x', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        flush(inj);

                        viewer.offset.x = -2;
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-2);
                        expect(viewer.offset.x).toEqual(-2);

                        viewer.offset.x = -1;
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        expect(viewer.offset.x).toEqual(-1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Pans when modifying bound offset y', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        flush(inj);

                        viewer.offset.y = -2;
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);
                        expect(viewer.offset.y).toEqual(-2);

                        viewer.offset.y = -1;
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-1);
                        expect(viewer.offset.y).toEqual(-1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Pans when modifying bound offsetX', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        flush(inj);

                        viewer.offsetX = -2;
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-2);
                        expect(viewer.offsetX).toEqual(-2);

                        viewer.offsetX = -1;
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        expect(viewer.offsetX).toEqual(-1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Pans when modifying bound offsetY', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        flush(inj);

                        viewer.offsetY = -2;
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);
                        expect(viewer.offsetY).toEqual(-2);

                        viewer.offsetY = -1;
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-1);
                        expect(viewer.offsetY).toEqual(-1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Does not error when invalid offset set', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        flush(inj);

                        expect(function () {
                            viewer.offset = null;
                            flush(inj);
                        }).not.toThrow();

                        expect(viewer.offset.y).toBeUndefined();
                        expect(viewer.offset.x).toBeUndefined();

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
            });
            describe('Rotating > ', function () {
                describe('Rotate methods > ', function () {
                    it('Rotates right', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotateRight();
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(90);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Rotates left', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotateLeft();
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(-90);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Does not error with an invalid rotation', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(function () {
                            viewer.rotateTo('a');
                            flush(inj);
                        }).not.toThrow();

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
                describe('Bound rotation > ', function () {
                    it('Rotates when bound rotation changes', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotation = 90;
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(90);
                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                        
                        viewer.rotation = -90;
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(-90);
                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Rounds to the nearest 90 degrees', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotation = 95;
                        flush(inj);

                        expect(viewer.rotation).toEqual(90);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
                describe('Panning update > ', function () {
                    it('Uses proper dimension limits when rotated and panning', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotation = 90;
                        flush(inj);

                        viewer.panTo(-1, -1);
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toEqual(0);
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toEqual(0);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                    it('Uses proper dimensions when rotated and panning', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoom = 100;
                        flush(inj);

                        viewer.rotation = 90;
                        flush(inj);

                        viewer.panTo(-1, -1);
                        flush(inj);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toEqual(-1);
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toEqual(-1);

                        expect(inj.$scope.myViewer.loading).toBeNull();
                    });
                });
            });
            describe('Dimensions > ', function () {
                it('Does not error with invalid width', function () {
                    var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                    expect(function () {
                        viewer.width = 'a';
                        flush(inj);
                    }).not.toThrow();

                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                    expect(inj.$scope.myViewer.loading).toBeNull();

                });
                it('Sets the container width', function () {
                    var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                    viewer.width = 100;
                    flush(inj);

                    expect(viewer.width).toEqual(100);
                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                    expect(inj.$el.children().css('width')).toEqual('100px');

                    expect(inj.$scope.myViewer.loading).toBeNull();

                });
                it('Does not error with invalid height', function () {
                    var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                    expect(function () {
                        viewer.height = 'a';
                        flush(inj);
                    }).not.toThrow();

                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                    expect(inj.$scope.myViewer.loading).toBeNull();

                });
                it('Sets the container height', function () {
                    var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                    viewer.height = 100;
                    flush(inj);

                    expect(viewer.height).toEqual(100);
                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                    expect(inj.$el.children().css('height')).toEqual('100px');

                    expect(inj.$scope.myViewer.loading).toBeNull();

                });
            });
        });
        describe('Mouse Functionality > ', function () {
            
            function mouseDirective(inj, data) {
                var $el = initDirective('<div pdf-viewer="options" pdf-url="pdfUrl" id="my-viewer"></div>', inj, data);
                skipToTheEnd(inj);
                return $el;
            }

            describe('Browser Compatability > ', function () {
                it('Zooms in with positive scroll', function () {
                    var inj = init(),
                        $el = mouseDirective(inj, {
                            options: {
                                mouseZoom: true,
                                mousePan: true
                            },
                            pdfUrl: 'mockUrl'
                        }),
                        event = _.extend(angular.element.Event('wheel'), {
                            originalEvent: {
                                wheelDelta: 100
                            }
                        });

                    $el.find('div').trigger(event);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBeGreaterThan(1);
                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);

                    expect(inj.$scope.myViewer.loading).toBeNull();
                });
                it('Pans with mouse', function () {
                    var inj = init(),
                        $el = mouseDirective(inj, {
                            pdfUrl: 'mockUrl'
                        }),
                        mouseStart = _.extend(angular.element.Event('mousedown'), {
                            originalEvent: {
                                x: 10,
                                y: 1
                            }
                        }),
                        moveLeftEvent = _.extend(angular.element.Event('mousemove'), {
                            originalEvent: {
                                x: 1,
                                y: 1
                            }
                        }),
                        moveRightEvent = _.extend(angular.element.Event('mousemove'), {
                            originalEvent: {
                                x: 2,
                                y: 1
                            }
                        }),
                        viewer = inj.$scope.myViewer;

                    viewer.zoomIn(100);
                    flush(inj);

                    $el.find('div').trigger(mouseStart);
                    flush(inj);

                    $el.find('div').trigger(moveLeftEvent);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-9);

                    $el.find('div').trigger(moveRightEvent);
                    flush(inj);


                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-8);

                    expect(inj.$scope.myViewer.loading).toBeNull();

                });

            });
            describe('Zooming > ', function () {
                it('Zooms in with positive scroll', function () {
                    var inj = init(),
                        $el = mouseDirective(inj, {
                            pdfUrl: 'mockUrl'
                        }),
                        event = _.extend(angular.element.Event('wheel'), {
                            wheelDelta: 100
                        });

                    $el.find('div').trigger(event);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBeGreaterThan(1);
                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);

                    expect(inj.$scope.myViewer.loading).toBeNull();
                });
                it('Zooms out with negative scroll', function () {
                    var inj = init(),
                        $el = mouseDirective(inj, {
                            pdfUrl: 'mockUrl'
                        }),
                        event = _.extend(angular.element.Event('wheel'), {
                            wheelDelta: -100
                        }),
                        viewer = inj.$scope.myViewer;

                    viewer.zoomIn();
                    flush(inj);

                    $el.find('div').trigger(event);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBeLessThan(1);
                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);

                    expect(inj.$scope.myViewer.loading).toBeNull();
                });
                it('Allows disabling mouse functions through options', function () {
                    var inj = init(),
                        $el = mouseDirective(inj, {
                            options: {
                                mouseZoom: false
                            },
                            pdfUrl: 'mockUrl'
                        }),
                        event = _.extend(angular.element.Event('wheel'), {
                            wheelDelta: 100
                        });

                    $el.find('div').trigger(event);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBe(1);
                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                    expect(inj.$scope.myViewer.loading).toBeNull();
                });
            });
            describe('Panning > ', function () {
                it('Pans with mouse', function () {
                    var inj = init(),
                        $el = mouseDirective(inj, {
                            pdfUrl: 'mockUrl'
                        }),
                        mouseStart = _.extend(angular.element.Event('mousedown'), {
                            clientX: 10,
                            clientY: 1
                        }),
                        moveLeftEvent = _.extend(angular.element.Event('mousemove'), {
                            clientX: 1,
                            clientY: 1
                        }),
                        moveRightEvent = _.extend(angular.element.Event('mousemove'), {
                            clientX: 2,
                            clientY: 1
                        }),
                        viewer = inj.$scope.myViewer;

                    viewer.zoomIn(100);
                    flush(inj);
                    
                    $el.find('div').trigger(mouseStart);
                    flush(inj);

                    $el.find('div').trigger(moveLeftEvent);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-9);

                    $el.find('div').trigger(moveRightEvent);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-8);

                    expect(inj.$scope.myViewer.loading).toBeNull();
                    
                });
                
                it('Allows disabling mouse pan through options', function () {
                    var inj = init(),
                        $el = mouseDirective(inj, {
                            options: {
                                mousePan: false
                            },
                            pdfUrl: 'mockUrl'
                        }),
                        mouseStart = _.extend(angular.element.Event('mousedown'), {
                            clientX: 0,
                            clientY: 0
                        }),
                        mouseMove = _.extend(angular.element.Event('mousemove'), {
                            clientX: 1,
                            clientY: 1
                        }),
                        viewer = inj.$scope.myViewer;

                    viewer.zoomIn();
                    flush(inj);

                    $el.find('div').trigger(mouseStart);
                    flush(inj);

                    $el.find('div').trigger(mouseMove);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(2);

                    expect(inj.$scope.myViewer.loading).toBeNull();
                });
                it('Does not continue to render after mouse released', function () {
                    var inj = init(),
                        $el = mouseDirective(inj, {
                            pdfUrl: 'mockUrl'
                        }),
                        mouseStart = _.extend(angular.element.Event('mousedown'), {
                            clientX: 10,
                            clientY: 1
                        }),
                        moveLeftEvent = _.extend(angular.element.Event('mousemove'), {
                            clientX: 1,
                            clientY: 1
                        }),
                        moveRightEvent = _.extend(angular.element.Event('mousemove'), {
                            clientX: 2,
                            clientY: 1
                        }),
                        mouseEnd = angular.element.Event('mouseup'),
                        viewer = inj.$scope.myViewer;

                    viewer.zoomIn(100);
                    flush(inj);

                    $el.find('div').trigger(mouseStart);
                    flush(inj);

                    $el.find('div').trigger(moveLeftEvent);
                    flush(inj);

                    $el.find('div').trigger(mouseEnd);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-9);

                    $el.find('div').trigger(moveRightEvent);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(3);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).not.toBe(-8);

                    expect(inj.$scope.myViewer.loading).toBeNull();
                });
                it('Pans with touch', function () {
                    var inj = init(),
                        $el = mouseDirective(inj, {
                            pdfUrl: 'mockUrl'
                        }),
                        mouseStart = _.extend(angular.element.Event('touchstart'), {
                            touches: [
                                {
                                    clientX: 10,
                                    clientY: 1
                                }
                            ]
                        }),
                        moveLeftEvent = _.extend(angular.element.Event('touchmove'), {
                            touches: [
                                {
                                    clientX: 1,
                                    clientY: 1
                                }
                            ]
                        }),
                        moveRightEvent = _.extend(angular.element.Event('touchmove'), {
                            touches: [
                                {
                                    clientX: 2,
                                    clientY: 1
                                }
                            ]
                        }),
                        viewer = inj.$scope.myViewer;

                    viewer.zoomIn(100);
                    flush(inj);

                    $el.find('div').trigger(mouseStart);
                    flush(inj);

                    $el.find('div').trigger(moveLeftEvent);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-9);

                    $el.find('div').trigger(moveRightEvent);
                    flush(inj);


                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-8);

                    expect(inj.$scope.myViewer.loading).toBeNull();

                });
            });
            describe('Cleanup > ', function () {
                it('Detaches events upon destroy', function () {
                    var inj = init(),
                        $el = mouseDirective(inj, {
                            pdfUrl: 'mockUrl'
                        }),
                        event = _.extend(angular.element.Event('wheel'), {
                            wheelDelta: 100
                        });

                    inj.$scope.$broadcast('$destroy');
                    flush(inj);
                    
                    $el.find('div').trigger(event);
                    flush(inj);

                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                    expect(inj.$scope.myViewer.loading).toBeNull();
                });
            });
        });
    });

}());
