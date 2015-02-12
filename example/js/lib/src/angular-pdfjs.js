/* global Object, Math, PDFJS, angular */

(function (Object, Math, PDFJS, angular) {
    'use strict';
    angular.module('angular-pdfjs', [
        
    ])
    .run(function () {
        PDFJS.verbosity = PDFJS.VERBOSITY_LEVELS.errors;
    })
    .directive('pdfViewer', function () {
        return {
            restrict: 'A',
            controller: ["$scope", "$q", function ($scope, $q) {
                var canvasElement,
                    canvasContext,
                    currentPage,
                    pdfDocument,
                    loading,
                    zoomSpeed    = 0.25,
                    panSpeed     = 10,
                    rotateSpeed  = 90,
                    pageCount    = 0,
                    oState       = {},
                    cState       = {},
                    fState       = {},
                    vState       = {
                        offset: {}
                    },
                    defer        = $q.defer(),
                    emptyPromise = defer.promise;

                function clearState() {
                    angular.extend(cState, {
                        page:     0,
                        rotation: 0,
                        offsetX:  0,
                        offsetY:  0,
                        scale:    1,
                        width:    0,
                        height:   0
                    });
                    angular.extend(fState, cState, {page: 1});
                    angular.extend(vState, fState);
                    loading         = null;
                    oState.viewport = null;
                }

                defer.resolve();
                clearState();

                function okToRender() {
                    return pdfDocument &&
                           canvasContext &&
                           !angular.equals(cState, fState);
                }

                function resetState() {
                    loading = null;
                    angular.extend(cState, fState);
                    angular.extend(vState, fState);
                    $scope.$applyAsync();
                }

                function renderPage() {
                    if (okToRender()) {
                        loading = pdfDocument.getPage(fState.page).then(function (_page) {
                            var viewport,
                                viewBox,
                                width,
                                height;

                            viewport              = _page.getViewport(1);
                            angular.extend(oState, {
                                page: 1,
                                rotation: viewport.rotation,
                                offsetX: viewport.offsetX,
                                offsetY: viewport.offsetY,
                                scale: viewport.scale,
                                width: viewport.width,
                                height: viewport.height
                            }, oState);
                            width                 = fState.rotation % 180 ? oState.height : oState.width;
                            height                = fState.rotation % 180 ? oState.width : oState.height;
                            fState.width          = fState.width || width;
                            fState.height         = fState.height || height;
                            canvasElement.width   = fState.rotation % 180 ? fState.height : fState.width;
                            canvasElement.height  = fState.rotation % 180 ? fState.width : fState.height;
                            viewBox               = [0, 0, width, height];
                            currentPage           = _page;
                            viewport              = new PDFJS.PageViewport(viewBox, fState.scale, fState.rotation, fState.offsetX, fState.offsetY);

                            _page.render({
                                canvasContext: canvasContext,
                                viewport: viewport
                            });
                            resetState();
                        });
                        return loading;
                    }
                    return emptyPromise;
                }

                function previousPage() {
                    return goToPage(cState.page - 1);
                }
                function nextPage() {
                    return goToPage(cState.page + 1);
                }
                function goToPage(pageNumber) {
                    pageNumber  = pageNumber === 0 ? 1 : pageNumber;
                    pageNumber  = pageNumber > pageCount ? pageCount : pageNumber;
                    vState.page = pageNumber;
                    pageNumber  = parseInt(pageNumber);
                    if (!isNaN(pageNumber)) {
                        fState.page = pageNumber;
                        return renderPage();
                    }
                    return emptyPromise;
                }

                function setWidth(width) {
                    vState.width = width;
                    width        = parseFloat(width);
                    if (!isNaN(width)) {
                        fState.width = width;
                        return renderPage();
                    }
                    return emptyPromise;
                }
                function setHeight(height) {
                    vState.height = height;
                    height        = parseFloat(height);
                    if (!isNaN(height)) {
                        fState.height = height;
                        return renderPage();
                    }
                    return emptyPromise;
                }


                function setZoomSpeed(speed) {
                    speed = parseFloat(speed);
                    if (!isNaN(speed) && speed > 0) {
                        zoomSpeed = speed;
                    }
                }
                function zoomIn(speed) {
                    speed = isNaN(parseFloat(speed)) ? zoomSpeed : parseFloat(speed);
                    return zoomTo(cState.scale + speed);
                }
                function zoomOut(speed) {
                    speed = isNaN(parseFloat(speed)) ? zoomSpeed : parseFloat(speed);
                    return zoomTo(cState.scale - speed);
                }
                function zoomTo(scale) {
                    vState.scale = scale;
                    scale        = parseFloat(scale);
                    if (!isNaN(scale) && scale > 0) {
                        fState.scale = scale;
                        return renderPage();
                    }
                    return emptyPromise;
                }

                function setPanSpeed(speed) {
                    speed = parseFloat(speed);
                    if (!isNaN(speed) && speed > 0) {
                        panSpeed = speed;
                    }
                }
                function panLeft(speed) {
                    speed = isNaN(parseFloat(speed)) ? panSpeed : parseFloat(speed);
                    return panTo(cState.offsetX + speed, cState.offsetY);
                }
                function panRight(speed) {
                    speed = isNaN(parseFloat(speed)) ? panSpeed : parseFloat(speed);
                    return panTo(cState.offsetX - speed, cState.offsetY);
                }
                function panUp(speed) {
                    speed = isNaN(parseFloat(speed)) ? panSpeed : parseFloat(speed);
                    return panTo(cState.offsetX, cState.offsetY + speed);
                }
                function panDown(speed) {
                    speed = isNaN(parseFloat(speed)) ? panSpeed : parseFloat(speed);
                    return panTo(cState.offsetX, cState.offsetY - speed);
                }
                function panTo(x, y) {
                    x   = x > 0 ? 0 : x;
                    x   = x < -cState.width ? -cState.width : x;
                    y   = y > 0 ? 0 : y;
                    y   = y < -cState.height ? -cState.height : y;

                    vState.offsetX = x;
                    vState.offsetY = y;

                    x   = parseFloat(x);
                    y   = parseFloat(y);
                    if (!isNaN(x) && !isNaN(y)) {
                        fState.offsetX = x;
                        fState.offsetY = y;
                        return renderPage();
                    }
                    return emptyPromise;
                }
                function setOffsetX(offsetX) {
                    vState.offsetX = offsetX;
                    return setOffset({
                        x: offsetX,
                        y: vState.offsetY
                    });
                }
                function setOffsetY(offsetY) {
                    vState.offsetY = offsetY;
                    return setOffset({
                        x: vState.offsetX,
                        y: offsetY
                    });
                }
                function setOffset(offset) {
                    offset = offset || {};
                    return panTo(offset.x, offset.y);
                }

                function rotateLeft() {
                    return rotateTo(cState.rotation - rotateSpeed);
                }
                function rotateRight() {
                    return rotateTo(cState.rotation + rotateSpeed);
                }
                function rotateTo(rotation) {
                    vState.rotation = rotation;
                    rotation        = parseFloat(rotation);
                    if (!isNaN(rotation)) {
                        fState.rotation = Math.round(rotation / 90) * 90;
                        return renderPage();
                    }
                    return emptyPromise;
                }

                function loadDocument(url) {
                    if (url) {
                        loading = PDFJS.getDocument(url).then(function (_pdfDocument) {
                            clearState();
                            pdfDocument = _pdfDocument;
                            pageCount   = pdfDocument.numPages;
                            return renderPage();
                        });
                        return loading;
                    }
                    return emptyPromise;
                }

                

                function setCanvas(element) {
                    canvasElement = element;
                    canvasContext = canvasElement.getContext('2d');
                }

                function getCanvas() {
                    return canvasElement;
                }

                function getDocument() {
                    return pdfDocument;
                }
                Object.defineProperties(vState.offset, {
                    x: {
                        set: setOffsetX,
                        get: function () {
                            return vState.offsetX;
                        }
                    },
                    y: {
                        set: setOffsetY,
                        get: function () {
                            return vState.offsetY;
                        }
                    }
                });
                Object.defineProperties(this, {
                    setHeight: {
                        value: setHeight
                    },
                    setWidth: {
                        value: setWidth
                    },

                    setZoomSpeed: {
                        value: setZoomSpeed
                    },
                    zoomIn: {
                        value: zoomIn
                    },
                    zoomOut: {
                        value: zoomOut
                    },
                    zoomTo: {
                        value: zoomTo
                    },
                    
                    setPanSpeed: {
                        value: setPanSpeed
                    },
                    panLeft: {
                        value: panLeft
                    },
                    panRight: {
                        value: panRight
                    },
                    panUp: {
                        value: panUp
                    },
                    panDown: {
                        value: panDown
                    },
                    panTo: {
                        value: panTo
                    },

                    rotateLeft: {
                        value: rotateLeft
                    },
                    rotateRight: {
                        value: rotateRight
                    },
                    rotateTo: {
                        value: rotateTo
                    },

                    nextPage: {
                        value: nextPage
                    },
                    previousPage: {
                        value: previousPage
                    },
                    goToPage: {
                        value: goToPage
                    },

                    loadDocument: {
                        value: loadDocument
                    },
                    setCanvas: {
                        value: setCanvas
                    },
                    getCanvas: {
                        value: getCanvas
                    },
                    getDocument: {
                        value: getDocument
                    },

                    total: {
                        set: angular.noop,
                        get: function () {
                            return pageCount;
                        }
                    },
                    page: {
                        set: goToPage,
                        get: function () {
                            return vState.page;
                        }
                    },
                    width: {
                        set: setWidth,
                        get: function () {
                            return vState.width;
                        }
                    },
                    height: {
                        set: setHeight,
                        get: function () {
                            return vState.height;
                        }
                    },
                    zoom: {
                        set: zoomTo,
                        get: function () {
                            return vState.scale;
                        }
                    },
                    rotation: {
                        set: rotateTo,
                        get: function () {
                            return vState.rotation;
                        }
                    },
                    offsetX: {
                        set: panLeft,
                        get: function () {
                            return vState.offsetX;
                        }
                    },
                    offsetY: {
                        set: panUp,
                        get: function () {
                            return vState.offsetY;
                        }
                    },
                    offset: {
                        set: setOffset,
                        get: function () {
                            return vState.offset;
                        }
                    },
                    
                    loading: {
                        set: angular.noop,
                        get: function () {
                            return loading;
                        }
                    }
                });
            }],
            link: function ($scope, el, attrs, ctrl) {
                $scope.$watch(attrs.pdfUrl, function (url) {
                    if (url) {
                        ctrl.loadDocument(url);
                    }
                });

                if (attrs.id) {
                    $scope[attrs.$normalize(attrs.id)] = ctrl;
                }

                var canvas = angular.element('<canvas></canvas>');
                ctrl.setCanvas(canvas[0]);
                el.append(canvas);
                el.css({
                    overflow: 'hidden'
                });
            }
        };
    });
}(Object, Math, PDFJS, angular));
