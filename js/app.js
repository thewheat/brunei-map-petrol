"use strict";

function stationCtrl($scope, $filter, $http, $timeout){
    $scope.searchFacilityData = {};
    $scope.facilities = ["ATM","Car Wash","Pump","Pump (foreign)","Service Center","Shop","Surau","Toilet"];
    $scope.searchOpen = true;

    $http.get("data/stations.json").success(function(data) {
        for(var i = 0; i < data.length; i++){
            data[i].id = i;
            APP.map.initAddMarker({
                "name": data[i].name,
                "lat": data[i].lat,
                "lng": data[i].lng,
                "close": data[i].close,
                "facilities": data[i].facilities
            });
        }
        $scope.filteredStations = $scope.stations = data;
        $scope.calculateDistances();

    });

    $scope.searchMap = function(){
        var data = $scope.stations;
        var clearMarkers = [];
        if(!data) return;
        var dataSearchFacility = [];

        dataSearchFacility = dataSearchFacility.concat($scope.stations.filter(function(x,i){
            var result = true;
            for(var d in $scope.searchFacilityData){
                if($scope.searchFacilityData[d]){
                    result = result && (x.facilities.indexOf(d) > -1)
                }
            }
            if($scope.searchOpen){
                var nowDate = new Date();
                var nowTime = nowDate.getHours() * 100 + nowDate.getMinutes();
                result = result && x.open <= nowTime && nowTime <= x.close;
            }

            if(!result){
                clearMarkers.push(i);
            }
            return result;
        }));
        data = dataSearchFacility;
        $scope.filteredStations = data;
        if(clearMarkers.length > 0)
            APP.map.clearMarkers(clearMarkers);
        else
            APP.map.updateMap();

        $timeout(function(){
            $scope.showClosest(data);
        }, 500);

    }

    $scope.location = {
        "lat": APP.map.DEFAULT_CENTER.lat,
        "lng": APP.map.DEFAULT_CENTER.lng
    };
    $scope.showClosest = function(data){
        var closest = $filter('limitTo')($filter('orderBy')(data, 'distance'), 1);
        if(closest){
            var marker = closest[0];
            APP.map.closest(marker ? marker.id : -1);
        }
        else{
            APP.map.stopBounce();
        }
    }
    $scope.clickMarker = function(id){
        APP.map.clickMarker(id);
    }
    $scope.calculateDistances = function(){
        var data = $scope.stations;
        // if(!data && $scope.filteredStations) data = $scope.filteredStations;
        // else if(!data && $scope.stations) data = $scope.stations;
        if (!data) {
            $scope.UpdateResultsMessage = "No station data";
            return;
        }
        for(var i = 0; i < data.length; i++){
            if($scope.location && $scope.location.lat && $scope.location.lng){
                data[i].distance =
                    (data[i].lat - $scope.location.lat)*(data[i].lat - $scope.location.lat) +
                    (data[i].lng - $scope.location.lng)*(data[i].lng - $scope.location.lng);
                var lat1 = data[i].lat;
                var lon1 = data[i].lng;
                var lat2 = $scope.location.lat;
                var lon2 = $scope.location.lng;

                var R = 6371; // km
                var dLat = (lat2-lat1) * Math.PI / 180;
                var dLon = (lon2-lon1) * Math.PI / 180;
                lat1 = lat1 * Math.PI / 180;
                lat2 = lat2 * Math.PI / 180;

                var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
                var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                var d = R * c;
                data[i].distance = d;

            }
            else data[i].distance =  i;
        }
        $scope.stations = data;
    };
    $scope.setLocation = function(lat, lng){
        if(!$scope.location) $scope.location = {};
        $scope.location.lat = lat;
        $scope.location.lng = lng;
        APP.map.centerMap($scope.location);
    };
    $scope.dismissInfo = function(){
        $scope.findLocationMessage = "";
    }
    $scope.findLocation = function(fallback_coordinate){
        $scope.findLocationMessage = "Detecting location...";
        if (navigator.geolocation)
        {
            navigator.geolocation.getCurrentPosition(function(position){
                $scope.findLocationMessage = "Location Found";
                $timeout(function(){
                    $scope.findLocationMessage = "";
                }, 500);
                if(!$scope.location) $scope.location = {};
                $scope.location.lat = position.coords.latitude;
                $scope.location.lng = position.coords.longitude;
                $scope.searchMap();
                APP.map.centerMapAndUpdate({"lat": $scope.location.lat, "lng": $scope.location.lng});
            }, function(err){
                console.error("Error getting location", err)
                // not sure why this doesn't set correctly without a delay *shrug*
                $timeout(function(){
                    $scope.findLocationMessage = "Error loading location: " + err.message + ". Using default location";
                    $scope.searchMap();
                    APP.map.centerMapAndUpdate({"lat": fallback_coordinate.lat, "lng": fallback_coordinate.lng});
                }, 500);
            });
        }
        else{
            $scope.findLocationMessage = "HTML 5 not supported";
        }
    };
  }
//]);

var APP = {};
APP.map = APP.map || (function(){
    var map;
    var mapElement;
    var initMarkers;
    var markers;
    var center;
    var closestIndex = -1;
    function init(element){
        mapElement = element;
        markers = [];
        initMarkers = [];
        map = null;
        center = null;
    }
    var DEFAULT_CENTER = {
            "lat": 4.87921,
            "lng": 114.947891
    };
    function load(){
        var mapOptions = {
            zoom: 12,
            center: new google.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
            gestureHandling: 'greedy'
        };
        map = new google.maps.Map(mapElement, mapOptions);
        centerMap(DEFAULT_CENTER);
        google.maps.event.addListener(map, "click", function(event) {
            centerMapAndUpdate({"lat": event.latLng.lat(),"lng": event.latLng.lng()});
        });

        for(var i = 0; initMarkers && i < initMarkers.length; i++){
          addMarker(initMarkers[i]);
        }

        var scope = angular.element(document.getElementById("stationCtrl")).scope();
        scope.findLocation(DEFAULT_CENTER);
    }
    function initAddMarker(markerData){
        if(map == null)
          initMarkers.push(markerData);
        else
          addMarker(markerData);
    }
    function addMarker(markerData){
        var marker = {};
        marker.name = markerData.name ? "<h3>" + markerData.name + "</h3>" : "";
        marker.name += "<b>Hours</b>: " + markerData.close;
        if(markerData.facilities && markerData.facilities.length > 0){
            marker.name += "<br><b>Facilities</b>:<ul>";
            for(var i = 0; i < markerData.facilities.length; i++)
                marker.name += "<li>" + markerData.facilities[i];
            marker.name += "</ul>";
        }

        marker.location = {
            lat: markerData.lat ? markerData.lat : 0,
            lng: markerData.lng ? markerData.lng : 0
        };
        marker.notes = markerData.notes ? markerData.notes : "";
        marker.libMarker = createMapMarker(marker);
        markers.push(marker);
        recenter();
    }
    function createMapMarker(marker){
        var myLatlng = new google.maps.LatLng(marker.location.lat,marker.location.lng);
        var libMarker = new google.maps.Marker({
          position: myLatlng,
          map: map,
          title: marker.name
        });
        google.maps.event.addListener(libMarker, "click", function(pos) {
            centerMapAndUpdate({"lat": libMarker.position.lat(),"lng": libMarker.position.lng()});
        });

        return libMarker;
    }
    function updateMap(){
        clearMarkers();
        for(var i = 0; i < markers.length; i++){
            markers[i].libMarker  = createMapMarker(markers[i]);
        }
    }
    function stopBounce(){
        if(closestIndex >= 0){
            markers[closestIndex].libMarker.setAnimation(null);
            closestIndex = -1;
        }
    }
    function closest(i){
        if(closestIndex != i){
            stopBounce();
            closestIndex = i;
            if(markers[i] && markers[i].libMarker){
                markers[i].libMarker.setAnimation(google.maps.Animation.BOUNCE);
            }
        }
    }
    function getMarkers(){
        return markers;
    }
    function clearMarkers(array){
        if(!markers || !markers.length) return;
        if(array){
            for(var i = 0; i < markers.length; i++){
                if(array.indexOf(i) > -1)
                    markers[i].libMarker.setMap(null);
                else if (markers[i].libMarker.getMap() == null)
                    markers[i].libMarker.setMap(map);
            }
        }
        else{
            for(var i = 0; i < markers.length; i++)
                markers[i].libMarker.setMap(null);
        }
    }
    function centerMapAndUpdate(coordinate){
        var scope = angular.element(document.getElementById("stationCtrl")).scope();
        scope.setLocation(coordinate.lat, coordinate.lng);
        scope.calculateDistances();
        scope.showClosest(scope.filteredStations);
    }
    function clickMarker(id){
        google.maps.event.trigger(markers[id].libMarker, 'click');
    }
    function recenter(){ // for redrawing purposes so it shows on top of markers
        if(!map) { console.log("Map not yet loaded!"); return; }
        centerMap({"lat": map.getCenter().lat(),"lng": map.getCenter().lng()});
    }
    function centerMap(coordinate){
        if(!coordinate || !coordinate.lat || !coordinate.lng) return;
        if(center && center.setMap) center.setMap(null);
        var options = {
            strokeColor: "#0000FF",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#FF0000",
            fillOpacity: 0.35,
            map: map,
            center: new google.maps.LatLng(coordinate.lat, coordinate.lng),
            radius: 200 * 12 / map.getZoom(),
        };
        center = new google.maps.Circle(options);
        map.setCenter(center.center);
    }
    return {
        init: init,
        load: load,
        addMarker: addMarker,
        initAddMarker: initAddMarker,
        getMarkers: getMarkers,
        clearMarkers: clearMarkers,
        updateMap: updateMap,
        centerMap: centerMap,
        clickMarker: clickMarker,
        recenter: recenter,
        closest: closest,
        stopBounce: stopBounce,
        centerMapAndUpdate: centerMapAndUpdate,
        DEFAULT_CENTER: DEFAULT_CENTER
    };
}());
APP.map.init(document.getElementById("map-canvas"));
google.maps.event.addDomListener(window, "load", function(){ console.log("load map"); APP.map.load() });
