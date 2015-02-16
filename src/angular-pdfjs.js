/* global Object, Math, PDFJS, angular */

(function (Object, Math, PDFJS, angular) {
    'use strict';
    angular.module('angular-pdfjs', [
        
    ])
    .run(function () {
        PDFJS.verbosity = PDFJS.VERBOSITY_LEVELS.errors;
    })
    .directive('pdfViewer', function ($parse) {
        return {
            restrict: 'A',
            controller: function ($scope, $q) {
                var containerElement,
                    canvasElement,
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
                
                function resetState() {
                    loading = null;
                    angular.extend(cState, fState);
                    angular.extend(vState, cState);
                    $scope.$applyAsync();
                }

                function okToRender() {
                    return pdfDocument &&
                           canvasContext &&
                           !loading &&
                           !angular.equals(cState, fState);
                }

                function oStateInitialize(viewport) {
                    angular.extend(oState, {
                        page: 1,
                        rotation: viewport.rotation,
                        offsetX:  viewport.offsetX,
                        offsetY:  viewport.offsetY,
                        scale:    viewport.scale,
                        width:    viewport.width,
                        height:   viewport.height
                    }, oState);
                    fState.width  = fState.width || oState.width;
                    fState.height = fState.height || oState.height;
                }

                function renderPage() {
                    if (okToRender()) {
                        loading = pdfDocument.getPage(fState.page).then(function (_page) {
                            var viewBox,
                                viewport;

                            oStateInitialize(_page.getViewport(1));

                            currentPage = _page;
                            viewBox     = [0, 0, oState.width, oState.height];
                            viewport    = new PDFJS.PageViewport(viewBox, fState.scale, fState.rotation, fState.offsetX, fState.offsetY);

                            setContainerSize();
                            loading = _page.render({
                                canvasContext: canvasContext,
                                viewport: viewport
                            }).then(function () {
                                resetState();
                            });
                        });
                        return loading;
                    }
                    return emptyPromise;
                }

                function setContainerSize() {
                    var width  = fState.rotation % 180 ? fState.height : fState.width;
                    var height = fState.rotation % 180 ? fState.width : fState.height;
                    containerElement.css({
                        width: width + 'px',
                        height: height + 'px'
                    });
                    canvasElement.attr('width', width);
                    canvasElement.attr('height', height);
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
                    if (!isNaN(width) && width > 0) {
                        fState.width = width;
                        return renderPage();
                    }
                    return emptyPromise;
                }
                function setHeight(height) {
                    vState.height = height;
                    height        = parseFloat(height);
                    if (!isNaN(height) && height > 0) {
                        fState.height = height;
                        return renderPage();
                    }
                    return emptyPromise;
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
                    var width = cState.rotation % 180 ? cState.height : cState.width;
                    var height = cState.rotation % 180 ? cState.width : cState.height;
                    var minX = width - (cState.scale * width);
                    var minY = height - (cState.scale * height);
                    
                    x   = x < minX ? minX : x;
                    x   = x > 0 ? 0 : x;
                    y   = y < minY ? minY : y;
                    y   = y > 0 ? 0 : y;
                    
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

                function setElements(container, element) {
                    containerElement = container;
                    canvasElement    = element;
                    canvasContext    = canvasElement[0].getContext('2d');
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

                    zoomIn: {
                        value: zoomIn
                    },
                    zoomOut: {
                        value: zoomOut
                    },
                    zoomTo: {
                        value: zoomTo
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
                    setElements: {
                        value: setElements
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
                defer.resolve();
                clearState();
            },
            link: function ($scope, el, attrs, ctrl) {
                var moveState = null,
                    canvas    = angular.element('<canvas></canvas>'),
                    container = angular.element('<div></div>'),
                    options   = angular.extend({
                        mouseZoom: true,
                        mousePan:  true
                    }, $scope.$eval(attrs.pdfViewer)),
                    offset = {
                        x: 0,
                        y: 0
                    };

                ctrl.setElements(container, canvas);

                container.append(canvas);
                el.append(container);
                container.css({
                    overflow: 'hidden'
                });

                if (attrs.id) {
                    $scope[attrs.$normalize(attrs.id)] = ctrl;
                }

                function linkUrl(url) {
                    ctrl.loadDocument(url);
                }

                function mouseWheel(event) {
                    event.preventDefault();
                    event.stopImmediatePropagation();

                    var dy = (event.originalEvent && event.originalEvent.wheelDelta) || event.wheelDelta;
                    ctrl.zoomIn(dy / 100);
                }
                function moveStart(event) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    var x = (event.originalEvent && event.originalEvent.x) || event.x;
                    var y = (event.originalEvent && event.originalEvent.y) || event.y;
                    moveState = {
                        x: x - offset.x,
                        y: y - offset.y
                    };
                }
                function moveEnd(event) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    moveState = null;
                }
                function move(event) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    var x = (event.originalEvent && event.originalEvent.x) || event.x;
                    var y = (event.originalEvent && event.originalEvent.y) || event.y;
                    if (moveState) {
                        ctrl.offset = offset = {
                            x: x - moveState.x,
                            y: y - moveState.y
                        };
                    }
                }
                if (options.mouseZoom) {
                    container.on('wheel', mouseWheel);
                }
                if (options.mousePan) {
                    canvas.css({
                        cursor: 'move'
                    });
                    container.on('touchstart mousedown', moveStart);
                    container.on('touchmove mousemove', move);
                    container.on('touchend touchleave touchcancel mouseup mouseleave', moveEnd);
                }
                $scope.$on('$destroy', function () {
                    container.off();
                });

                $scope.$watch(attrs.pdfUrl, linkUrl);
            }
        };
    });
}(Object, Math, PDFJS, angular));
