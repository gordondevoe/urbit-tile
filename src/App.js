import logo from "./logo.svg";
import "./App.css";
import React, { useState, useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer } from "react-leaflet"
import L from "leaflet";
import { urbitVisor } from "@dcspark/uv-core";
import Amplify, { API } from "aws-amplify";
import awsconfig from "./aws-exports";
import { listShips } from "./graphql/queries";
import { createShip as createShipMutation, updateShip as updateShipMutation, deleteShip as deleteShipMutation} from "./graphql/mutations";
import { sigil, reactRenderer, stringRenderer } from '@tlon/sigil-js'

Amplify.configure(awsconfig);

function App() {

  const [myShip, setMyShip] = useState(null);
  const [location, setLocation] = useState(null);
  const [map, setMap] = useState(null);
  const [ships, setShips] = useState(null);
  const [selectedShip, setSelectedShip] = useState(null);
  const [dragged, setDragged] = useState(false);
  
  async function fetchShips(loadedMap) {

    const apiData = await API.graphql({ query: listShips });

    const tempShips = apiData.data.listShips.items.map(ship => {

      const splitLocation = ship.location.split(",");

      const marker = L.marker([splitLocation[0], splitLocation[1]], 
        {title: ship.name, icon: new L.DivIcon({
          iconSize: [50, 50],
          html:      '<div>' + sigil({
            patp: '~' + ship.name,
            renderer: stringRenderer,
            size: 50,
            colors: ['black', 'white'],
           }) + '</div>'})
      });

      if(ship.name === myShip){

        marker.on('click', function (e) {

          setSelectedShip(ship.name);  
          loadedMap.setView(new L.LatLng(ship.location.split(",")[0], ship.location.split(",")[1]), 18);
          setDragged(false);

        });

      }

      else{

        marker.on('click', function (e) {

          setSelectedShip(ship.name);  
          loadedMap.setView(new L.LatLng(ship.location.split(",")[0], ship.location.split(",")[1]), 18);     
  
        });

      }

      marker.on('mouseover', function (e) {

        marker.openPopup();

      });

      const tempShip = {...ship, location: ship.location, marker: marker};

      return tempShip;

    })

    setShips(tempShips);

    loadedMap.on('movestart', function (e) {

      setDragged(true);

    });

  }

  async function deleteShip(shipName) {

    const apiData = await API.graphql({ query: listShips });

    apiData.data.listShips.items.map(ship => {
      
      if(ship.name === shipName) {

        API.graphql({ query: deleteShipMutation, variables: { input: { id: ship.id } }})

        const tempShips = ships.filter(ship => ship.name !== shipName);

        setShips(tempShips);
      
      }

      return ship;
  
    });
  
  }

  async function updateShip() {
  
    const shipIndex = ships.findIndex((ship => ship.name === myShip));

    if (shipIndex !== -1) {

      if(location && ships[shipIndex].location !== location) {

        var tempShip = {id: ships[shipIndex].id, name: ships[shipIndex].name, location: location};

        await API.graphql({ query: updateShipMutation, variables: { input: tempShip }}); 

        const splitLocation = location.split(",");

        const marker = L.marker([splitLocation[0], splitLocation[1]],         
          {title: ships[shipIndex].name, icon: new L.DivIcon({
            iconSize: [50, 50],
            className: "App-blinking",
            html:      '<div>' + sigil({
              patp: '~' + ships[shipIndex].name,
              renderer: stringRenderer,
              size: 50,
              colors: ['black', 'white'],
            }) + '</div>'
          })
        });

        marker.on('click', () => {

            setSelectedShip(myShip);
            map.setView(new L.LatLng(location.split(",")[0], location.split(",")[1]), 18);
            setDragged(false);

        });

        marker.on('mouseover', function (e) {

          marker.openPopup();
  
        });
        
        tempShip.marker = marker;

        var tempShips = [...ships];

        tempShips[shipIndex] = tempShip;

        setShips(tempShips);

      }

    }

  }

  async function createShip() {

    const shipIndex = ships.findIndex((ship => ship.name === myShip));

    if(shipIndex === -1) {

      const updateResults = await API.graphql({ query: createShipMutation, variables: { input: {name: myShip, location: location} } });

      const splitLocation = location.split(",");

      const marker = L.marker([splitLocation[0], splitLocation[1]],         
        {title: myShip, icon: new L.DivIcon({
        iconSize: [50, 50],
        className: "App-blinking",
        html:      '<div>' + sigil({
          patp: '~' + myShip,
          renderer: stringRenderer,
          size: 50,
          colors: ['black', 'white'],
         }) + '</div>'
        })
      });

      marker.on('click', function (e) {

        setSelectedShip(myShip);
        map.setView(new L.LatLng(location.split(",")[0], location.split(",")[1]), 18);
        setDragged(false);

      });

      marker.on('mouseover', function (e) {

        marker.openPopup();

      });

      setShips([ ...ships, {id: updateResults.data.createShip.id, name: myShip, location: location, marker: marker} ]);

    }

  }

  function setShipData() {    
    
    urbitVisor.getShip().then((res) => {
    
      setMyShip(res.response);
      setSelectedShip(res.response)
    
    });

  }

  useEffect(() => {

    // deleteShip('nopsed-nomber')

    delete L.Icon.Default.prototype._getIconUrl;

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
      iconUrl: require("leaflet/dist/images/marker-icon.png"),
      shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
    });

    urbitVisor.require(["shipName"], setShipData);

  }, []);

  useEffect(() => {

    if(myShip) {

      function connect() {

        var watchID;

        const options = {
          enableHighAccuracy: true,
          timeout:5000,
          maximumAge: 0
        };
      
        function success(position) {

          clearTimeout(location_timeout);

          const coordinates = position.coords;

          setLocation(`${coordinates.latitude},${coordinates.longitude}`);

        }

        function error(err) {

          if(navigator.geolocation) {

            navigator.geolocation.clearWatch(watchID);

          }

          connect();

        }

        var location_timeout = setTimeout(() => {

          if(navigator.geolocation && myShip) {

            watchID = navigator.geolocation.watchPosition(success, error, options);

          }

        }, 1000);

      }

      connect();    

    }

  }, [myShip]);


  useEffect(() => {

    if(map && ships) {

      updateShip();

      map.eachLayer((layer) => {

        if(layer['_latlng'] !== undefined){

            layer.remove();

        }

      });

      ships.map(ship => {

        const splitLocation = ship.location.split(",");

        const popUpData = `<p><b>~${ship.name}</b><br>${splitLocation[0]}, ${splitLocation[1]}</p>`;

        ship.marker.bindPopup(popUpData, {autoClose: false});

        map.addLayer(ship.marker);        

        return ship;

      });

    }

    if(myShip && location && ships) {

      createShip();

    }

    if(map && location && selectedShip && myShip && ships) {

      if(!dragged) {

        map.setView(new L.LatLng(location.split(',')[0],location.split(',')[1]), 18);

        if(selectedShip == myShip){

          setDragged(false);

        }

      }

    }

  }, [location, map, ships, myShip, selectedShip, dragged]);

  return (
    <div className="App">
      <div className="App-body">
        {<p>Urbit Tile is under <a className="App-link" target="_blank" rel="noreferrer noopener" href="https://github.com/gordondevoe/urbit-tile">Development</a>.</p> }
        <p><a href="https://tile.computer"><img src={logo} alt="urbit-tile-logo"/></a></p>
        {!myShip && <p style={{marginTop: 0}} className="App-pulse">Connecting your Urbit ship with the <a className="App-link" href="https://chrome.google.com/webstore/detail/urbit-visor/oadimaacghcacmfipakhadejgalcaepg">Urbit Visor</a> web extension...</p>}
        {myShip && location && <table style={{marginBottom: '1em'}} className="App-pulse"><tbody><tr style={{cursor: 'pointer'}} onClick={() => {map.setView(new L.LatLng(location.split(",")[0], location.split(",")[1]), 18); setSelectedShip(myShip); setDragged(false);}}><td>{sigil({ patp: myShip, renderer: reactRenderer, size: 50, colors: ['black', 'white'] })}</td><td>&nbsp;~{myShip}</td></tr></tbody></table>}
        {myShip && !location && <p style={{marginTop: 0}} className="App-pulse"><span className="App-link">~{myShip}</span> Please share your location...</p>}
        {<MapContainer attributionControl={false} center={[35, -95]} zoom={2.5} style={{height: 384, width: "95%"}} whenCreated={(map) => { setMap(map); map.setView(new L.LatLng(35, -95), 2.5); fetchShips(map);}}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        </MapContainer>}
        {ships && location && <div><br/><table><tbody>{ships.sort(function(a, b) { return a.name.localeCompare(b.name);}).map(function(ship, idx){return (myShip !== ship.name && <tr style={{cursor: 'pointer'}} onClick={() => {map.setView(new L.LatLng(ship.location.split(",")[0], ship.location.split(",")[1]), 18); setSelectedShip(ship.name);}} key={idx}><td>{sigil({ patp: ship.name, renderer: reactRenderer, size: 50, colors: ['black', 'white'] })}</td><td>&nbsp;~{ship.name}</td></tr>)})}</tbody></table></div>}
        {<p className="App-link">Urbit Tile 2022</p> }
      </div>
    </div>
  );
}

export default App;