/* global PDFJS, _, angular, jasmine, expect */

(function () {
    'use strict';

    function mockPromise(data, pause) {
        return {
            then: function (sFn) {
                if (pause) {
                    setTimeout(function () {
                        sFn(data);
                    }, 100);
                    return mockPromise(data, pause);
                } else {
                    return sFn(data);
                }
            }
        };
    }

    function mockDocument(totalPages, page) {
        page = page || mockPage();
        return {
            getPage: jasmine.createSpy('getPage').and.returnValue(mockPromise(page)),
            numPages: totalPages
        };
    }

    function mockPage(viewport) {
        viewport = viewport || mockPageViewport();
        return {
            getViewport: jasmine.createSpy('getViewport').and.returnValue(viewport),
            render: jasmine.createSpy('renderPage').and.returnValue(mockPromise())
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

    function mockPDFJS(document, pause) {
        return {
            VERBOSITY_LEVELS: {
                warnings: 1,
                errors: 2
            },
            PageViewport: function () {
                _.extend(this, mockPageViewport.apply(this, arguments));
            },
            getDocument: jasmine.createSpy().and.returnValue(mockPromise(document, pause))
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

        inject(function ($compile, $rootScope) {
            _.defaults(inj, {
                $scope: $rootScope.$new(),
                $compile: $compile
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
            it('Exposes a loading indicator', function () {
                var inj = init({}, {
                        PDFJS: mockPDFJS(mockDocument(1, mockPage(mockPageViewport())), true)
                    });

                directive(inj, {
                    pdfUrl: 'mockUrl'
                });

                expect(inj.$scope.myViewer.loading).toBeDefined();
                jasmine.clock().tick(101);
                expect(inj.$scope.myViewer.loading).toBeUndefined();

            });
        });
        describe('Page Navigation > ', function () {
            
            it('Goes to the next page', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.nextPage();
                
                expect(inj.pdfjs.document.getPage.calls.count()).toBe(2);
                expect(viewer.page).toBe(2);
                expect(inj.pdfjs.document.getPage.calls.mostRecent().args[0]).toBe(2);
            });
            it('Goes to a maximum page', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.page = 4;

                expect(inj.pdfjs.document.getPage.calls.count()).toBe(2);
                expect(viewer.page).toBe(3);
            });
            it('Goes to a minimum of page 1', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.previousPage();

                expect(inj.pdfjs.document.getPage.calls.count()).toBe(1);
                expect(viewer.page).toBe(1);
            });
            it('Will not render if page isNaN', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.page = 'not a number';

                expect(inj.pdfjs.document.getPage.calls.count()).toBe(1);
            });
            it('Exposes the total number of pages', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                expect(viewer.total).toEqual(inj.pdfjs.document.numPages);
                
            });
            it('Does not allow the setting of total pages', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.total = 100;
                expect(viewer.total).toEqual(inj.pdfjs.document.numPages);

            });
        });
        describe('Page Rendering > ', function () {
            describe('Zooming > ', function () {
                describe('Zoom in > ', function () {
                    it('Zooms in', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomIn();

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBeGreaterThan(1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                    });
                    it('Zooms in with params', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomIn(4);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBe(5);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                    });
                });
                describe('Zoom out > ', function () {
                    it('Zooms out', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomOut();
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBeLessThan(1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                    });

                    it('Zooms out to a minimum', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomOut(4);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBe(1);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                });
                describe('Bound zoom > ', function () {
                    it('Zooms when modifying bound zoom', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoom = 100;

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBe(100);
                        expect(viewer.zoom).toEqual(100);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                    });
                });
            });
            describe('Panning > ', function () {
                describe('Pan Right > ', function () {
                    it('Does not pan right beyond page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panRight(1);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panRight, 'a')).not.toThrow();
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Pans right within page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        viewer.panRight(1);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        
                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
                    });
                });
                describe('Pan Left > ', function () {
                    it('Does not pan left beyond page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panLeft(1);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panLeft, 'a')).not.toThrow();
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Pans left within page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        
                        viewer.panRight(2);
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-2);
                        
                        viewer.panLeft(1);
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        
                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    });
                });
                describe('Pan Up > ', function () {
                    it('Does not pan up beyond page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panUp(1);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panUp, 'a')).not.toThrow();
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Pans up within page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        
                        viewer.panDown(2);
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);

                        viewer.panUp(1);
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    });
                });
                describe('Pan Down > ', function () {
                    it('Does not pan down beyond page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panDown(1);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panDown, 'a')).not.toThrow();
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Pans up within page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        viewer.panDown(2);
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
                    });
                });
                describe('Pan To > ', function () {
                    it('Does not error with invalid pan arguments', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panTo, 'a', 'b')).not.toThrow();

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                });
                describe('Bound offsets > ', function () {

                    it('Pans when modifying bound offset x', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        viewer.offset.x = -2;
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-2);
                        expect(viewer.offset.x).toEqual(-2);

                        viewer.offset.x = -1;
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        expect(viewer.offset.x).toEqual(-1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    });
                    it('Pans when modifying bound offset y', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        viewer.offset.y = -2;
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);
                        expect(viewer.offset.y).toEqual(-2);

                        viewer.offset.y = -1;
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-1);
                        expect(viewer.offset.y).toEqual(-1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    });
                    it('Pans when modifying bound offsetX', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        viewer.offsetX = -2;
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-2);
                        expect(viewer.offsetX).toEqual(-2);

                        viewer.offsetX = -1;
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        expect(viewer.offsetX).toEqual(-1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    });
                    it('Pans when modifying bound offsetY', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        viewer.offsetY = -2;
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);
                        expect(viewer.offsetY).toEqual(-2);

                        viewer.offsetY = -1;
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-1);
                        expect(viewer.offsetY).toEqual(-1);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    });
                    it('Does not error when invalid offset set', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        expect(function () {
                            viewer.offset = null;
                        }).not.toThrow();

                        expect(viewer.offset.y).toBeUndefined();
                        expect(viewer.offset.x).toBeUndefined();
                    });
                });
            });
            describe('Rotating > ', function () {
                describe('Rotate methods > ', function () {
                    it('Rotates right', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotateRight();

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(90);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                    });
                    it('Rotates left', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotateLeft();

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(-90);

                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                    });
                    it('Does not error with an invalid rotation', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.rotateTo, 'a')).not.toThrow();

                        expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                    });
                });
                describe('Bound rotation > ', function () {
                    it('Rotates when bound rotation changes', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotation = 90;
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(90);
                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                        
                        viewer.rotation = -90;
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(-90);
                        expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
                    });
                    it('Rounds to the nearest 90 degrees', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotation = 95;
                        expect(viewer.rotation).toEqual(90);
                    });
                });
                describe('Panning update > ', function () {
                    it('Uses proper dimension limits when rotated and panning', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotation = 90;
                        viewer.panTo(-1, -1);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toEqual(0);
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toEqual(0);
                    });
                    it('Uses proper dimensions when rotated and panning', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoom = 100;
                        viewer.rotation = 90;
                        viewer.panTo(-1, -1);

                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toEqual(-1);
                        expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetY).toEqual(-1);
                    });
                });
            });
            describe('Dimensions > ', function () {
                it('Does not error with invalid width', function () {
                    var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                    expect(function () {
                        viewer.width = 'a';
                    }).not.toThrow();

                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                });
                it('Sets the container width', function () {
                    var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                    viewer.width = 100;

                    expect(viewer.width).toEqual(100);
                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                    expect(inj.$el.children().css('width')).toEqual('100px');

                });
                it('Does not error with invalid height', function () {
                    var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                    expect(function () {
                        viewer.height = 'a';
                    }).not.toThrow();

                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);

                });
                it('Sets the container height', function () {
                    var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                    viewer.height = 100;

                    expect(viewer.height).toEqual(100);
                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
                    expect(inj.$el.children().css('height')).toEqual('100px');

                });
            });
        });
        describe('Mouse Functionality > ', function () {
            
            var mouseDirective = _.partial(initDirective, '<div pdf-viewer="options" pdf-url="pdfUrl" id="my-viewer"></div>');

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

                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBeGreaterThan(1);
                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
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

                    $el.find('div').trigger(mouseStart);
                    $el.find('div').trigger(moveLeftEvent);

                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-9);

                    $el.find('div').trigger(moveRightEvent);


                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-8);

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

                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBeGreaterThan(1);
                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(1);
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
                    $el.find('div').trigger(event);

                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBeLessThan(1);
                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
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

                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.scale).toBe(1);
                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
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
                    
                    $el.find('div').trigger(mouseStart);
                    $el.find('div').trigger(moveLeftEvent);

                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-9);

                    $el.find('div').trigger(moveRightEvent);


                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-8);
                    
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

                    $el.find('div').trigger(mouseStart);
                    $el.find('div').trigger(mouseMove);

                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(2);
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

                    $el.find('div').trigger(mouseStart);
                    $el.find('div').trigger(moveLeftEvent);
                    $el.find('div').trigger(mouseEnd);

                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-9);

                    $el.find('div').trigger(moveRightEvent);

                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(3);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).not.toBe(-8);
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

                    $el.find('div').trigger(mouseStart);
                    $el.find('div').trigger(moveLeftEvent);

                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(2);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-9);

                    $el.find('div').trigger(moveRightEvent);


                    expect(inj.pdfjs.page.render.calls.count()).toBeGreaterThan(3);
                    expect(inj.pdfjs.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-8);

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
                    
                    $el.find('div').trigger(event);

                    expect(inj.pdfjs.page.render.calls.count()).not.toBeGreaterThan(1);
                });
            });
        });
    });

}());
