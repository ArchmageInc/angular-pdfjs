# angular-pdfjs *(v0.0.6)*

This project was started because of the lack of control available by other existing PDFJS directive wrappers. It was designed to be light-weight yet fully functional. 
The directive allows multiple custom controls to **Rotate**, **Pan**, **Zoom**, **Page**, and **Change PDF** without polluting the scope or requiring a service injection.
It was written in such a way that additional directives, such as a common PDF View Control Toolbar, can easily integrate, without cluttering the scope.

## Dependencies

1. [AngularJS](https://angularjs.org/)
2. [PDF.js](http://mozilla.github.io/pdf.js/)

PDFJS is the JavaScript library developed by Mozilla which renders PDFs onto HTML5 canvas elements. 

## Installation

* angular-pdfjs is available as a bower dependency and can be installed with:

```
bower install angular-pdfjs
```

* The script files can then be imported into your project as usual:

```html
<script src="bower_components/pdfjs-dist/web/compatibility.js" ></script>
<script src="bower_components/pdfjs-dist/build/pdf.js" ></script>
<script src="bower_components/angular/angular.js" ></script>
<script src="bower_components/angular-pdfjs/dist/angular-pdfjs.min.js" ></script>
```

*The compatability package of PDFJS is not required, though it includes es5-polyfills which are required for older browser support.*

* The module can now be included as a dependency in your application:

```js
var myApp = angular.module('myApp', ['angular-pdfjs']);
```

## Usage

### Directive

The directive allows passing in the URL for the PDF, which will be watched for changes.

```html
<div
    pdf-viewer="options"
    pdf-url="pdfUrlScopeVar"
    id="my-pdf-viewer"
></div>
```

The simple use is to assign a value to the *pdf-url* attribute and go. More control is available through the controller.

<rant>Go figure, who would have thought you should control something with it's controller? 
Apparently not most angular developer's I have seen, because most of them seem to think cluttering up the scope is the best way to go about this.
Some hide it by isolating the scope, but an isolated mess, is still a mess. </rant>

**options**
The options is a hash used to override the default abilities of using the mouse to pan and mouse wheel to zoom.
It is not required and by default would look like this:

```js
{
  mouseZoom: true,
  mousePan:  true
}
```

### Controller
This directive, similar to how ng-form and ng-model operate, will attach the controller to the scope if provided an *id* attribute.
The scope property name will be the normalized value of the *id* attribute. (I am not sure why ng-form and ng-model do not use the normalized name)
This controller will provide access to manipulate the PDF in a number of ways.

#### Methods
The controller provides access to various methods for control.

#### Dimensions
- **setHeight(heightInPx)** Sets the container's height to a specified value. 
- **setWidth(widthInPx)** Sets the container's width to a specified value.

#### Zooming
- **zoomIn(\[speed])** Zooms the PDF larger, if *speed* is not specified, 25% (0.25) is used.
- **zoomOut(\[speed])** Zooms the PDF smaller, if *speed* is not specified, 25% (0.25) is used.
- **zoomTo(scale)** Zooms the PDF to the specified scale, it is pinned to the top left corner.

#### Panning
- **panLeft(\[speed])** Pans (moves the viewpoint of) the PDF to the left. If *speed* is not specified, 10 pixels is used.
- **panRight(\[speed])** Pans the PDF to the right with a default speed of 10 pixels.
- **panUp(\[speed])** Pans the PDF up with a default speed of 10 pixels.
- **panDown(\[speed])** Pans the PDF down with a default speed of 10 pixels.
- **panTo(x, y)** Pans the PDF to the specified point. **NOTE** offset values are always negative, as the PDF is pinned to the top left corner.

#### Rotation
- **rotateLeft(\[deg])** Rotates the PDF counter clockwise in 90 degree increments. 
- **rotateRight(\[deg])** Rotates the PDF clockwise in 90 degree increments.
- **rotateTo(\[deg])** Rotates the PDF to a specified degree, rounded to the nearest 90 degrees.

#### Paging
- **nextPage()** Loads the next page of the PDF, if there is one.
- **previousPage()** Loads the previous page of the PDF, if there is one.
- **goToPage(pageNumber)** Loads the specified page, if it exists.

#### Document
- **loadDocument(url)** Attempts to retrieve a PDF from the specified URL. This will reset paging, rotation, dimensions, and offsets.
- **getDocument()** Returns the current PDFJS pdf document


#### Properties
The controller provides access to properties, which can be bound to an ngModel controller for manipulation.

- **loading** *(Read Only)* The promise if PDFJS is currently rendering, null otherwise. Can be used for ng-show loading indicators.
- **total** *(Read Only)* The total number of pages in the current PDF
- **page** The current page number, valid range is 1 to **total**
- **width** The viewable width of the PDF, in pixels. When loaded, defaults to the actual with of the PDF. Valid range is greater than 0.
- **height** The viewable height of the PDF, in pixels. When loaded, defaults to the actual height of the PDF. Valid range is greater than 0.
- **zoom** The magnification level of the PDF. When loaded, defaults to 1. Valid range is greater than 0.
- **rotation** The rotation, in degrees, of the PDF. When loaded, defaults to 0. Valid range is in increments of 90.
- **offsetX** The horizontal offset, in pixels, of the viewable PDF. When loaded, defaults to 0. Valid range is **width** - ( **zoom** * **width** ) to 0
- **offsetY** The vertical offset, in pixels, of the viewable PDF. When loaded, defaults to 0. Valid range is **height** - ( **zoom** * **height** ) to 0
- **offset** A hash containing an **x** and **y** value corresponding to the **offsetX** and **offsetY**. (Useful for directly replacing the offset in one assignment)

Given our above example implementation, any element in the same scope would able to use ng-click to execute a method:

```html
<button type="button" ng-click="myPdfViewer.nextPage()" >Next</button>
```

For direct inputs, ng-model can be used to bind to the property:

```html
<input type="number" min="1" max="{{myPdfViewer.total}} ng-model="myPdfViewer.page" />
```

A controller on the scope, is able to use additional logic and interface with the PDF:

```js
myApp.controller('myCtrl', function ($scope) {
    $scope.myGoToPage = function (page) {
        if (page !== 4) {
            $scope.myPdfViewer.goToPage(page);
        } else {
            alert('Not that page, it is terrible');
        }
    }
});
```

A controller on the scope is also able to add watchers to the properties:

```js
myApp.controller('myOtherCtrl', function ($scope) {
    $scope.$watch('myPdfViewer.page', function (newPage, oldPage) {
        if (page === 4) {
            alert('I told you not to go to that page');
            $scope.myPdfViewer.goToPage(oldPage);
        }
    }
});
```

Custom directives can require it to be available:

```js
myApp.directive('myDirective', function () {
    return {
        restrict: 'A',
        require: '^pdfViewer',
        template: 'my-toolbar-template.html',
        link: function ($scope, el, attrs, myPdfViewer) {
            myPdfViewer.loadDocument('my-pdf.pdf').then(function () {
                myPdfViewer.goToPage(4);
            });
        }
    };
}
```

### Contributing

While this directive is very small, feedback and suggestions are always welcome. 
Not that I will be able to get around to them, so feel free to submit a pull request, or fork me for all I care.

