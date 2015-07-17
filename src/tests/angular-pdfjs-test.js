/* global PDFJS */

(function () {
    'use strict';

    function mockPromise(data) {
        return {
            then: jasmine.createSpy('then').and.callFake(function (sFn) {
                return sFn(data);
            })
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

    function init(mocks) {
        mocks = _.extend({}, mocks);
        var inj = {};

        _.defaults(mocks, {

        });

        module('angular-pdfjs', function ($provide) {
            _.forEach(mocks, function (mock, mockName) {
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
        var inj = init(),
            viewport = mockPageViewport(),
            page = mockPage(viewport),
            document = mockDocument(3, page);

        _.merge(inj, {
            viewport: viewport,
            page: page,
            document: document
        });


        PDFJS.PageViewport = function () {
            _.extend(this, mockPageViewport.apply(this, arguments));
        };
        spyOn(PDFJS, 'getDocument').and.returnValue(mockPromise(document));



        inj.$el = directive(inj, {
            pdfUrl: 'mockUrl'
        });
        return inj;
    }

    describe('angular-pdfjs directive > ', function () {
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
                expect(inj.$scope.myViewer.getDocument()).toEqual(inj.document);
            });
        });
        describe('Page Navigation > ', function () {
            
            it('Goes to the next page', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.nextPage();
                
                expect(inj.document.getPage.calls.count()).toBe(2);
                expect(viewer.page).toBe(2);
                expect(inj.document.getPage.calls.mostRecent().args[0]).toBe(2);
            });
            it('Goes to a maximum page', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.page = 4;

                expect(inj.document.getPage.calls.count()).toBe(2);
                expect(viewer.page).toBe(3);
            });
            it('Goes to a minimum of page 1', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.previousPage();

                expect(inj.document.getPage.calls.count()).toBe(1);
                expect(viewer.page).toBe(1);
            });
            it('Will not render if page isNaN', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.page = 'not a number';

                expect(inj.document.getPage.calls.count()).toBe(1);
            });
            it('Exposes the total number of pages', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                expect(viewer.total).toEqual(inj.document.numPages);
                
            });
            it('Does not allow the setting of total pages', function () {
                var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                viewer.total = 100;
                expect(viewer.total).toEqual(inj.document.numPages);

            });
        });
        describe('Page Rendering > ', function () {
            describe('Zooming > ', function () {
                describe('Zoom in > ', function () {
                    it('Zooms in', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomIn();

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.scale).toBeGreaterThan(1);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(1);
                    });
                    it('Zooms in with params', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomIn(4);

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.scale).toBe(5);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(1);
                    });
                });
                describe('Zoom out > ', function () {
                    it('Zooms out', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomOut();
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.scale).toBeLessThan(1);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(1);
                    });

                    it('Zooms out to a minimum', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomOut(4);

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.scale).toBe(1);

                        expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                });
                describe('Bound zoom > ', function () {
                    it('Zooms when modifying bound zoom', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoom = 100;

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.scale).toBe(100);
                        expect(viewer.zoom).toEqual(100);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(1);
                    });
                });
            });
            describe('Panning > ', function () {
                describe('Pan Right > ', function () {
                    it('Does not pan right beyond page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panRight(1);

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panRight, 'a')).not.toThrow();
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Pans right within page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        viewer.panRight(1);

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        
                        expect(inj.page.render.calls.count()).toBeGreaterThan(2);
                    });
                });
                describe('Pan Left > ', function () {
                    it('Does not pan left beyond page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panLeft(1);

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panLeft, 'a')).not.toThrow();
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);
                        
                        expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Pans left within page width limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        
                        viewer.panRight(2);
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-2);
                        
                        viewer.panLeft(1);
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        
                        expect(inj.page.render.calls.count()).toBeGreaterThan(3);
                    });
                });
                describe('Pan Up > ', function () {
                    it('Does not pan up beyond page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panUp(1);

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panUp, 'a')).not.toThrow();
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Pans up within page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);
                        
                        viewer.panDown(2);
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);

                        viewer.panUp(1);
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-1);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(3);
                    });
                });
                describe('Pan Down > ', function () {
                    it('Does not pan down beyond page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.panDown(1);

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Does not error with invalid pan argument', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panDown, 'a')).not.toThrow();
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);

                        expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                    it('Pans up within page height limit', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        viewer.panDown(2);
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(2);
                    });
                });
                describe('Pan To > ', function () {
                    it('Does not error with invalid pan arguments', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.panTo, 'a', 'b')).not.toThrow();

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(0);
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(0);

                        expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);
                    });
                });
                describe('Bound offsets > ', function () {

                    it('Pans when modifying bound offset x', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        viewer.offset.x = -2;
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-2);
                        expect(viewer.offset.x).toEqual(-2);

                        viewer.offset.x = -1;
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        expect(viewer.offset.x).toEqual(-1);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(3);
                    });
                    it('Pans when modifying bound offset y', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        viewer.offset.y = -2;
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);
                        expect(viewer.offset.y).toEqual(-2);

                        viewer.offset.y = -1;
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-1);
                        expect(viewer.offset.y).toEqual(-1);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(3);
                    });
                    it('Pans when modifying bound offsetX', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        viewer.offsetX = -2;
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-2);
                        expect(viewer.offsetX).toEqual(-2);

                        viewer.offsetX = -1;
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toBe(-1);
                        expect(viewer.offsetX).toEqual(-1);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(3);
                    });
                    it('Pans when modifying bound offsetY', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoomTo(100);

                        viewer.offsetY = -2;
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-2);
                        expect(viewer.offsetY).toEqual(-2);

                        viewer.offsetY = -1;
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toBe(-1);
                        expect(viewer.offsetY).toEqual(-1);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(3);
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

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(90);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(1);
                    });
                    it('Rotates left', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotateLeft();

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(-90);

                        expect(inj.page.render.calls.count()).toBeGreaterThan(1);
                    });
                    it('Does not error with an invalid rotation', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        expect(_.partial(viewer.rotateTo, 'a')).not.toThrow();

                        expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);

                    });
                });
                describe('Bound rotation > ', function () {
                    it('Rotates when bound rotation changes', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.rotation = 90;
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(90);
                        expect(inj.page.render.calls.count()).toBeGreaterThan(1);
                        
                        viewer.rotation = -90;
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.rotation).toEqual(-90);
                        expect(inj.page.render.calls.count()).toBeGreaterThan(2);
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

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toEqual(0);
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toEqual(0);
                    });
                    it('Uses proper dimensions when rotated and panning', function () {
                        var inj = plainSetup(),
                        viewer = inj.$scope.myViewer;

                        viewer.zoom = 100;
                        viewer.rotation = 90;
                        viewer.panTo(-1, -1);

                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetX).toEqual(-1);
                        expect(inj.page.render.calls.mostRecent().args[0].viewport.offsetY).toEqual(-1);
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

                    expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);

                });
                it('Sets the container width', function () {
                    var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                    viewer.width = 100;

                    expect(viewer.width).toEqual(100);
                    expect(inj.page.render.calls.count()).toBeGreaterThan(1);
                    expect(inj.$el.children().css('width')).toEqual('100px');

                });
                it('Does not error with invalid height', function () {
                    var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                    expect(function () {
                        viewer.height = 'a';
                    }).not.toThrow();

                    expect(inj.page.render.calls.count()).not.toBeGreaterThan(1);

                });
                it('Sets the container height', function () {
                    var inj = plainSetup(),
                    viewer = inj.$scope.myViewer;

                    viewer.height = 100;

                    expect(viewer.height).toEqual(100);
                    expect(inj.page.render.calls.count()).toBeGreaterThan(1);
                    expect(inj.$el.children().css('height')).toEqual('100px');

                });
            });
        });
    });
}());
