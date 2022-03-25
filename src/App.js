import logo from "./logo.svg";
import "./App.css";
import React, { useState, useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer } from "react-leaflet"
import L from "leaflet";
import { urbitVisor } from "@dcspark/uv-core";
import Amplify, { API, graphqlOperation } from "aws-amplify";
import awsconfig from "./aws-exports";
import { listShips } from "./graphql/queries";
import { onUpdateShip, onCreateShip, onDeleteShip } from "./graphql/subscriptions";
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
  const [loaded, setLoaded] = useState(false);
  const [updatedShip, setUpdatedShip] = useState(null);
  const [createdShip, setCreatedShip] = useState(null);
  const [deletedShip, setDeletedShip] = useState(null);
  
  async function fetchShips(pLoadedMap) {

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

      marker.on('click', function (e) {

        setSelectedShip(ship.name);  
        pLoadedMap.setView(new L.LatLng(ship.location.split(",")[0], ship.location.split(",")[1]), 18);
        setDragged(false);

      });      

      const tempShip = {...ship, marker: marker};

      pLoadedMap.addLayer(tempShip.marker);

      return tempShip;

    })

    setShips(tempShips);

    pLoadedMap.on('movestart', function (e) {

      setDragged(true);

    });

    pLoadedMap.setView(new L.LatLng(35, -95), 2.5); 

    setMap(pLoadedMap);    

    setLoaded(true);

  }

  async function deleteShips(pShipName) {

    const apiData = await API.graphql({ query: listShips });

    apiData.data.listShips.items.map(ship => {
      
      if(ship.name === pShipName) {

        // console.log('Deleting Ship: ' + pShipName + ' Id: ' + ship.id);

        API.graphql({ query: deleteShipMutation, variables: { input: { id: ship.id } }})

        const tempShips = ships.filter(ship => ship.name !== pShipName);

        setShips(tempShips);
      
      }

      return ship;
  
    });
  
  }

  async function deleteShip(pShipName) {

    const shipIndex = ships.findIndex((ship => ship.name === pShipName));

    if (shipIndex !== -1) {

      // console.log('Deleting Ship: ' + pShipName);

      if(pShipName === myShip) {

        API.graphql({ query: deleteShipMutation, variables: { input: { id: ships[shipIndex].id } }})

      }

      const tempShips = ships.filter(ship => ship.name !== pShipName);

      map.removeLayer(ships[shipIndex].marker);

      setShips(tempShips);  
    
    }

  }

  async function updateShip(pShip) {
  
    const shipIndex = ships.findIndex((ship => ship.name === pShip.name));

    if (shipIndex !== -1) {

      if(ships[shipIndex].location !== pShip.location) {

        // console.log('Updating Ship: ' + pShip.name + ' Location: ' + pShip.location);

        var tempShip = {id: ships[shipIndex].id, name: ships[shipIndex].name, location: pShip.location};  
        
        if(pShip.name === myShip) {
        
          await API.graphql({ query: updateShipMutation, variables: { input: tempShip }});

        }

        const splitLocation = pShip.location.split(",");

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

          setSelectedShip(pShip.name);
          map.setView(new L.LatLng(pShip.location.split(",")[0], pShip.location.split(",")[1]), 18);
          setDragged(false);

        });
      
        tempShip.marker = marker;

        map.removeLayer(ships[shipIndex].marker);

        map.addLayer(tempShip.marker);

        var tempShips = [...ships];

        tempShips[shipIndex] = tempShip;

        setShips(tempShips);

      }

    }

  }

  async function createShip(pShip) {

    const shipIndex = ships.findIndex((ship => ship.name === pShip.name));

    if(shipIndex === -1) {

      // console.log('Creating Ship: Name: ' + pShip.name + ' Location: ' + pShip.location);

      if(pShip.name === myShip) {

        const createResults = await API.graphql({ query: createShipMutation, variables: { input: {name: myShip, location: location} } });
        
        pShip.id = createResults.data.createShip.id;

      }

      const splitLocation = pShip.location.split(",");

      const marker = L.marker([splitLocation[0], splitLocation[1]],         
        {title: pShip.name, icon: new L.DivIcon({
        iconSize: [50, 50],
        className: "App-blinking",
        html:      '<div>' + sigil({
          patp: '~' + pShip.name,
          renderer: stringRenderer,
          size: 50,
          colors: ['black', 'white'],
         }) + '</div>'
        })
      });

      marker.on('click', function (e) {

        setSelectedShip(pShip.name);
        map.setView(new L.LatLng(pShip.location.split(",")[0], pShip.location.split(",")[1]), 18);
        setDragged(false);

      });

      map.addLayer(marker);

      setShips([ ...ships, {id: pShip.id, name: pShip.name, location: pShip.location, marker: marker} ]);

    }

  }

  function setShipData() {    
    
    urbitVisor.getShip().then((res) => {
    
      setMyShip(res.response);
      setSelectedShip(res.response)
    
    });

  }

  useEffect(() => {

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

    if(ships && map) {

      //deleteShips('darret-hableb');

      // return;
      
    }

    if(map && ships && myShip && location) {

      updateShip({name: myShip, location: location});

    }

    if(myShip && location && ships) {

      createShip({name: myShip, location: location});

    }

    if(map && ships && loaded) {

      API.graphql(graphqlOperation(onUpdateShip)).subscribe({

        next: ({ provider, value }) => 
        {
  
            if(value['data']['onUpdateShip']['name'] !== myShip) {

              setUpdatedShip(value['data']['onUpdateShip']);

            }
  
        },
  
        error: error => console.warn(error)
  
      });

      API.graphql(graphqlOperation(onCreateShip)).subscribe({

        next: ({ provider, value }) => 
        {
  
            if(value['data']['onCreateShip']['name'] !== myShip) {

              setCreatedShip(value['data']['onCreateShip']);

            }
  
        },
  
        error: error => console.warn(error)
  
      });

      API.graphql(graphqlOperation(onDeleteShip)).subscribe({

        next: ({ provider, value }) => 
        {
  
            if(value['data']['onDeleteShip']['name'] !== myShip) {

              setDeletedShip(value['data']['onDeleteShip']);

            }
  
        },
  
        error: error => console.warn(error)
  
      });

      setLoaded(false);

    }

    if(map && location && selectedShip && myShip && ships) {   

      if(!dragged) {

        const shipIndex = ships.findIndex((ship => ship.name === selectedShip));

        if(shipIndex !== -1) {

          if(ships[shipIndex].name === myShip) {

            map.setView(new L.LatLng(location.split(',')[0], location.split(',')[1]), 18);

          }

          else {

            map.setView(new L.LatLng(ships[shipIndex].location.split(',')[0], ships[shipIndex].location.split(',')[1]), 18);

          }

          setDragged(false);

        }

      }

    }

    if(ships && map && updatedShip){
    
      updateShip({name: updatedShip['name'], location: updatedShip['location']});

      setUpdatedShip(null);

    }

    if(ships && map && createdShip){
    
      createShip({id: createdShip['id'], name: createdShip['name'], location: createdShip['location']});

      setCreatedShip(null);

    }

    if(ships && map && deletedShip){
    
      deleteShip(deletedShip['name']);

      setDeletedShip(null);

    }

  }, [location, map, ships, myShip, selectedShip, dragged, loaded, updatedShip, createdShip, deletedShip]);

  return (
    <div className="App">
      <div className="App-body">
        {<p>Urbit Tile is under <a className="App-link" target="_blank" rel="noreferrer noopener" href="https://github.com/gordondevoe/urbit-tile">Development</a>.</p> }
        <p><a href="https://tile.computer"><img src={logo} alt="urbit-tile-logo"/></a></p>
        {!myShip && <p style={{marginTop: 0}} className="App-pulse">Connecting your Urbit ship with the <a className="App-link" href="https://chrome.google.com/webstore/detail/urbit-visor/oadimaacghcacmfipakhadejgalcaepg">Urbit Visor</a> web extension...</p>}
        {myShip && location && <table style={{marginBottom: '1em'}} className="App-pulse"><tbody><tr style={{cursor: 'pointer'}} onClick={() => {map.setView(new L.LatLng(location.split(",")[0], location.split(",")[1]), 18); setSelectedShip(myShip); setDragged(false);}}><td>{sigil({ patp: myShip, renderer: reactRenderer, size: 50, colors: ['black', 'white'] })}</td><td>&nbsp;~{myShip}</td></tr></tbody></table>}
        {myShip && !location && <p style={{marginTop: 0}} className="App-pulse"><span className="App-link">~{myShip}</span> Please share your location...</p>}
        {<MapContainer attributionControl={false} center={[35, -95]} zoom={2.5} style={{height: 384, width: "95%"}} whenCreated={(map) => {fetchShips(map);}}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
        </MapContainer>}
        {ships && location && <div><br/><table><tbody>{ships.sort(function(a, b) { return a.name.localeCompare(b.name);}).map(function(ship, idx){return (myShip !== ship.name && <tr style={{cursor: 'pointer'}} onClick={() => {map.setView(new L.LatLng(ship.location.split(",")[0], ship.location.split(",")[1]), 18); setSelectedShip(ship.name); setDragged(false);}} key={idx}><td>{sigil({ patp: ship.name, renderer: reactRenderer, size: 50, colors: ['black', 'white'] })}</td><td>&nbsp;~{ship.name}</td></tr>)})}</tbody></table></div>}
        {<p className="App-link">Urbit Tile 2022</p> }
      </div>
    </div>
  );
}

export default App;