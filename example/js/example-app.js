/* angular */
(function (angular) {
    'use strict';
    angular.module('exampleApp', [
        'angular-pdfjs'
    ])
    .controller('exampleCtrl', function ($scope) {
        $scope.pdfFiles = [
            {
                url: 'pdf/AdobeXMLFormsSamples.pdf',
                name: 'Adobe form sample'
            },
            {
                url: 'pdf/pdf-sample.pdf',
                name: 'Simple Sample'
            }
        ];

        $scope.pdfUrl = '';
        
    });
}(angular));
