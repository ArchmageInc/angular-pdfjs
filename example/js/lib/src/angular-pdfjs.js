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
                    cState,
                    fState,
                    vState,
                    loading,
                    zoomSpeed    = 0.25,
                    panSpeed     = 10,
                    rotateSpeed  = 90,
                    pageCount    = 0,
                    defer        = $q.defer(),
                    emptyPromise = defer.promise;

                function clearState() {
                    cState = {
                        page:     0,
                        rotation: 0,
                        offsetX:  0,
                        offsetY:  0,
                        scale:    1,
                        width:    0,
                        height:   0
                    },
                    fState  = angular.extend({}, cState, {page: 1}),
                    vState  = angular.extend(fState);
                    loading = null;
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
                    angular.extend(vState, cState);
                    $scope.$applyAsync();
                }

                function renderPage() {
                    if (okToRender()) {
                        loading = pdfDocument.getPage(fState.page).then(function (_page) {
                            var viewport          = _page.getViewport(fState.scale);
                            canvasElement.width   = viewport.width;
                            canvasElement.height  = viewport.height;
                            fState.width          = viewport.width;
                            fState.height         = viewport.height;
                            currentPage           = _page;
                            viewport              = new PDFJS.PageViewport(viewport.viewBox, fState.scale, fState.rotation, fState.offsetX, fState.offsetY);

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
                    if (!isNaN(scale)) {
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
                    vState.offsetX = x;
                    vState.offsetY = y;
                    x              = parseFloat(x);
                    y              = parseFloat(y);
                    if (!isNaN(x) && !isNaN(y)) {
                        x = Math.min(0, Math.max(-cState.width, x));
                        y = Math.min(0, Math.max(-cState.height, y));
                        fState.offsetX = x;
                        fState.offsetY = y;
                        return renderPage();
                    }
                    return emptyPromise;
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


                Object.defineProperties(this, {
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
                        set: function (value) {
                            goToPage(value);
                        },
                        get: function () {
                            return vState.page;
                        }
                    },
                    zoom: {
                        set: function (value) {
                            zoomTo(value);
                        },
                        get: function () {
                            return vState.scale;
                        }
                    },
                    rotation: {
                        set: function (value) {
                            rotateTo(value);
                        },
                        get: function () {
                            return vState.rotation;
                        }
                    },
                    offset: {
                        set: function (value) {
                            if (value && value.x !== undefined && value.y !== undefined) {
                                panTo(value.x, value.y);
                            }
                        },
                        get: function () {
                            return {
                                x: vState.offsetX,
                                y: vState.offsetY
                            };
                        }
                    },
                    width: {
                        set: angular.noop,
                        get: function () {
                            return cState.width;
                        }
                    },
                    height: {
                        set: angular.noop,
                        get: function () {
                            return cState.height;
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
