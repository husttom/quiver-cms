'use strict';

/**
 * @ngdoc function
 * @name quiverCmsApp.controller:PageCtrl
 * @description
 * # PageCtrl
 * Controller of the quiverCmsApp
 */
angular.module('quiverCmsApp')
  .controller('PageCtrl', function ($scope, $rootScope, $stateParams, wordRef) {
    $scope.word = wordRef.$asObject();

  });
