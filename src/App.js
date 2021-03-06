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
import { updateShip as updateShipMutation } from "./graphql/mutations";
import { sigil, reactRenderer, stringRenderer } from '@tlon/sigil-js';

Amplify.configure(awsconfig);

function App() {

  const [myShip, setMyShip] = useState(null);
  const [location, setLocation] = useState(null);
  const [map, setMap] = useState(null);
  const [ships, setShips] = useState(null);
  const [selectedShip, setSelectedShip] = useState(null);
  const [dragged, setDragged] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [statusTimeout, setStatusTimeout] = useState(false);
  const [authToken, setAuthToken] = useState("tile");
  const [authorized, setAuthorized] = useState(false);
  const [updatedShip, setUpdatedShip] = useState(null);
  const [createdShip, setCreatedShip] = useState(null);
  const [deletedShip, setDeletedShip] = useState(null);
  
  async function fetchShips(pLoadedMap) { 

    const listShipsResult = await API.graphql(graphqlOperation(listShips, {}, authToken));

    const tempShips = listShipsResult.data.listShips.items.map(ship => {

      const updatedTime = new Date(ship.updatedAt);

      var seconds = Math.floor((Date.now() - updatedTime) / 1000);

      var status = 'green';

      if(seconds > 60 * 60) {

        status = 'yellow';

      }

      if(seconds > 60 * 60 * 24) {

        status = 'white';

      }

      const splitLocation = ship.location.split(",");

      const marker = L.marker([splitLocation[0], splitLocation[1]],
        {title: '~' + ship.name, icon: new L.DivIcon({
          className: 'App-icon', 
          iconSize: [50, 50],
          html: sigil({
            patp: '~' + ship.name,
            renderer: stringRenderer,
            size: 50,
            colors: ['black', status],
           })})
      });

      marker.on('click', function (event) {

        setSelectedShip(ship.name); 

        pLoadedMap.setView(new L.LatLng(ship.location.split(",")[0], ship.location.split(",")[1]), 18);

        setDragged(false);

      });      

      const tempShip = {...ship, marker: marker, status: status};

      pLoadedMap.addLayer(tempShip.marker);

      return tempShip;

    })

    setShips(tempShips);

    pLoadedMap.on('movestart', function (event) {

      setDragged(true);

    });

    pLoadedMap.setView(new L.LatLng(35, -95), 2.5); 

    setMap(pLoadedMap);    

    setLoaded(true);

  }

  async function setShipData() { 
    
    const shipResults = await urbitVisor.getShip();

    if(!shipResults.response.includes('--')) {
      
      setMyShip(shipResults.response); 

      setSelectedShip(shipResults.response);

      var timer = setInterval(checkAuthorization, 3000);

      var condition = false;

      async function checkAuthorization() {

        if(condition) {

          clearInterval(timer);
          
          return;

        }

        const res = await urbitVisor.authorizeShip('tilsem-mirfer');

        if(res.response && !res.response.includes('Fail')) {

          try {

            await API.graphql(graphqlOperation(listShips, { input: { name: shipResults.response, location: '0,0' } }, res.response));

          }

          catch {

            // console.log('Auth Failed!');

            return;

          }
  
          setAuthToken(res.response);
  
          setAuthorized(true);

          condition = true;
  
        }
        else {
  
          // console.log('Auth Failed!');
          
        }  

      }    

    }

  }

  useEffect(() => {

    delete L.Icon.Default.prototype._getIconUrl;

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
      iconUrl: require("leaflet/dist/images/marker-icon.png"),
      shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
      className: 'App-icon',
    });

    urbitVisor.on('disconnected', [], () => {

      setAuthToken('tile');

      setMyShip(null);

      setAuthorized(false);

      urbitVisor.require([ "auth", "shipName"], setShipData);

    });
    
    urbitVisor.require([ "auth", "shipName"], setShipData);

  }, []);

  useEffect(() => {

    if(myShip) {

      function connect() {

        var watchID;

        const options = {
          enableHighAccuracy: true,
          timeout: 5000,
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
  
    async function updateShip(pShip) {
    
      const shipIndex = ships.findIndex((ship => ship.name === pShip.name));
  
      if (shipIndex !== -1) {
  
        if(ships[shipIndex].location !== pShip.location) {
          
          // console.log('Updating Ship: ' + pShip.name + ' Location: ' + pShip.location + ' Status: ' + pShip.status);
  
          var tempShip = {id: ships[shipIndex].id, name: ships[shipIndex].name, location: pShip.location, status: pShip.status, updatedAt: pShip.updatedAt};
  
          const splitLocation = pShip.location.split(",");
  
          const marker = L.marker([splitLocation[0], splitLocation[1]],         
            {title: '~' + ships[shipIndex].name, icon: new L.DivIcon({
              className: 'App-icon',
              iconSize: [50, 50],
              html: sigil({
                patp: '~' + ships[shipIndex].name,
                renderer: stringRenderer,
                size: 50,
                colors: ['black', pShip.status],
              })
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

          if(pShip.name === myShip && authorized) {
            
            try {

              await API.graphql(graphqlOperation(updateShipMutation, { input: { id: tempShip.id, name: tempShip.name, location: tempShip.location } }, authToken) );
            
            }                
            catch(error) {

              // console.log('Auth failed!');

            }
  
          }
  
        }
  
      }
      else {

        createShip(pShip);

      }
  
    }
  
    async function createShip(pShip) {

      // console.log('Creating Ship: Name: ' + pShip.name + ' Location: ' + pShip.location);

      if(pShip.name === myShip) {

        try {

          const updateShipResults = await API.graphql(graphqlOperation(updateShipMutation, { input: { name: pShip.name, location: pShip.location } }, 'tile'));

          pShip.id = updateShipResults.data.listShips.items[0].id;

          pShip.updatedAt = updateShipResults.data.listShips.items[0].updatedAt;

        }    
        catch(error) {

          const listShipsResult = await API.graphql(graphqlOperation(listShips, { filter: { name: { eq: pShip.name } } }, 'tile') );
                            
          if(listShipsResult.data.listShips.items.length > 0) {

            pShip.id = listShipsResult.data.listShips.items[0].id;

            pShip.updatedAt = listShipsResult.data.listShips.items[0].updatedAt;

          }

        }     

      }

      const splitLocation = pShip.location.split(",");

      const marker = L.marker([splitLocation[0], splitLocation[1]],         
        {title: '~' + pShip.name, icon: new L.DivIcon({
        className: 'App-icon',
        iconSize: [50, 50],
        html: sigil({
          patp: '~' + pShip.name,
          renderer: stringRenderer,
          size: 50,
          colors: ['black', 'green'],
        })
        })
      });

      marker.on('click', function (event) {

        setSelectedShip(pShip.name);

        map.setView(new L.LatLng(pShip.location.split(",")[0], pShip.location.split(",")[1]), 18);

        setDragged(false);

      });

      map.addLayer(marker);

      setShips([ ...ships, {id: pShip.id, name: pShip.name, location: pShip.location, marker: marker, status: 'green', updatedAt: pShip.updatedAt } ]);     
  
    }

    if(map && ships && myShip && location && selectedShip) {

      var updatedAtDate = new Date();

      updateShip({name: myShip, location: location, updatedAt: updatedAtDate.toISOString(), status: 'green'});       

    }

  }, [location, map, ships, myShip, selectedShip, authToken, authorized]);


  useEffect(() => {

    async function updateShip(pShip) {
    
      const shipIndex = ships.findIndex((ship => ship.name === pShip.name));
  
      if (shipIndex !== -1) {
        
        // console.log('Updating Ship: ' + pShip.name + ' Location: ' + pShip.location + ' Status: ' + pShip.status);

        var tempShip = {id: ships[shipIndex].id, name: ships[shipIndex].name, location: pShip.location, status: pShip.status, updatedAt: pShip.updatedAt};

        const splitLocation = pShip.location.split(",");

        const marker = L.marker([splitLocation[0], splitLocation[1]],         
          {title: '~' + ships[shipIndex].name, icon: new L.DivIcon({
            className: 'App-icon',
            iconSize: [50, 50],
            html: sigil({
              patp: '~' + ships[shipIndex].name,
              renderer: stringRenderer,
              size: 50,
              colors: ['black', pShip.status],
            })
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

    if(map && ships && statusTimeout) {

      ships.map(ship => {

        const updatedTime = new Date(ship.updatedAt);

        var seconds = Math.floor((Date.now() - updatedTime) / 1000);

        var status = 'green';

        if(seconds > 60 * 60) {

          status = 'yellow';

        }

        if(seconds > 60 * 60 * 24) {

          status = 'white';

        }

        if(status !== ship.status) {

          updateShip({name: ship.name, location: ship.location, updatedAt: ship.updatedAt, status: status});

        }

        return {...ship, status: status};

      });      

      setStatusTimeout(false);

    }

  }, [map, ships, myShip, statusTimeout, authToken, authorized]);

  useEffect(() => {

    if(map && ships && loaded) {      

      setInterval(() => {

        setStatusTimeout(true);        

      }, 5000);        

      function connectUpdatedShip() {

        API.graphql(graphqlOperation(onUpdateShip, {}, 'tile')).subscribe({

          next: ({ provider, value }) => 
          {

            setUpdatedShip(value['data']['onUpdateShip']);

          },
    
          error: error => {

            if(error.errorMessage) { 

              if(error.errorMessage.includes('Socket')) {

                setTimeout(() => (connectUpdatedShip()), 1000);

              }

            }

          }
    
        });

      }

      connectUpdatedShip();

      function connectCreatedShip() {
        
        API.graphql(graphqlOperation(onCreateShip, {}, 'tile')).subscribe({

          next: ({ provider, value }) => 
          {
            
            setCreatedShip(value['data']['onCreateShip']);           
    
          },
    
          error: error => {

            if(error.errorMessage) { 

              if(error.errorMessage.includes('Socket')) {

                setTimeout(() => (connectCreatedShip()), 1000);

              }

            }

          }
    
        });

      }

      connectCreatedShip();

      function connectDeletedShip() {

        API.graphql(graphqlOperation(onDeleteShip, {}, 'tile')).subscribe({

          next: ({ provider, value }) => 
          {

            setDeletedShip(value['data']['onDeleteShip']);

          },
    
          error: error => {

            if(error.errorMessage) { 

              if(error.errorMessage.includes('Socket')) {

                setTimeout(() => (connectDeletedShip()), 1000);

              }

            }

          }
    
        });

      }

      connectDeletedShip();

      setLoaded(false);

    }

  }, [map, ships, loaded]);


  useEffect(() => {

    if(map && selectedShip && ships) { 

      if(!dragged) {

        const shipIndex = ships.findIndex((ship => ship.name === selectedShip));

        if(shipIndex !== -1) {

          if(ships[shipIndex].name === myShip) {

            if(location) {

              map.setView(new L.LatLng(location.split(',')[0], location.split(',')[1]), 18);

            }

          }

          else {

            map.setView(new L.LatLng(ships[shipIndex].location.split(',')[0], ships[shipIndex].location.split(',')[1]), 18);

          }

          setDragged(false);

        }

      }

    }

  }, [location, map, ships, myShip, selectedShip, dragged]);

  useEffect(() => {

    async function updateShip(pShip) {
    
      const shipIndex = ships.findIndex((ship => ship.name === pShip.name));
  
      if (shipIndex !== -1) {
  
        if(ships[shipIndex].location !== pShip.location) {
          
          // console.log('Updating Ship: ' + pShip.name + ' Location: ' + pShip.location + ' Status: ' + pShip.status);
  
          var tempShip = {id: ships[shipIndex].id, name: ships[shipIndex].name, location: pShip.location, status: pShip.status, updatedAt: pShip.updatedAt};
  
          const splitLocation = pShip.location.split(",");
  
          const marker = L.marker([splitLocation[0], splitLocation[1]],         
            {title: '~' + ships[shipIndex].name, icon: new L.DivIcon({
              className: 'App-icon',
              iconSize: [50, 50],
              html: sigil({
                patp: '~' + ships[shipIndex].name,
                renderer: stringRenderer,
                size: 50,
                colors: ['black', pShip.status],
              })
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

    if(ships && map && updatedShip) {

      if(updatedShip['name'] !== myShip) {
    
        updateShip({name: updatedShip['name'], location: updatedShip['location'], updatedAt: updatedShip['updatedAt'], status: 'green'});

      }

      setUpdatedShip(null);

    }

  }, [map, ships, myShip, selectedShip, updatedShip]);


  useEffect(() => {

    async function createShip(pShip) {

      // console.log('Creating Ship: Name: ' + pShip.name + ' Location: ' + pShip.location);

      const splitLocation = pShip.location.split(",");

      const marker = L.marker([splitLocation[0], splitLocation[1]],         
        {title: '~' + pShip.name, icon: new L.DivIcon({
        className: 'App-icon',
        iconSize: [50, 50],
        html: sigil({
          patp: '~' + pShip.name,
          renderer: stringRenderer,
          size: 50,
          colors: ['black', 'green'],
        })
        })
      });

      marker.on('click', function (event) {

        setSelectedShip(pShip.name);

        map.setView(new L.LatLng(pShip.location.split(",")[0], pShip.location.split(",")[1]), 18);

        setDragged(false);

      });

      map.addLayer(marker);

      setShips([ ...ships, {id: pShip.id, name: pShip.name, location: pShip.location, marker: marker, status: 'green', updatedAt: pShip.updatedAt } ]);     
  
    }

    if(ships && map && createdShip) {

      if(createdShip['name'] !== myShip) {
    
        createShip({id: createdShip['id'], name: createdShip['name'], location: createdShip['location'], updatedAt: createdShip['updatedAt']});

      }

      setCreatedShip(null);

    }

  }, [map, location, ships, myShip, createdShip]);    

  useEffect(() => {

    async function deleteShip(pShipName) {

      const shipIndex = ships.findIndex((ship => ship.name === pShipName));

      if (shipIndex !== -1) {

        // console.log('Deleting Ship: ' + pShipName);

        const tempShips = ships.filter(ship => ship.name !== pShipName);

        map.removeLayer(ships[shipIndex].marker);

        setShips(tempShips);
      
      }

    } 

    if(ships && map && deletedShip) {

      if(deletedShip['name'] !== myShip) {
    
        deleteShip(deletedShip['name']);

      }

      setDeletedShip(null);

    }

  }, [map, ships, myShip, deletedShip]);

  return (
    <div className="App">
      <div className="App-body">
        {<p style={{marginBottom: 0}}>Urbit Tile is under <a className="App-link" target="_blank" rel="noreferrer noopener" href="https://github.com/gordondevoe/urbit-tile">Development</a>.</p> }
        <p className="App-logo"><a href="https://tile.computer"><img src={logo} alt="urbit-tile-logo"/></a></p> 
        {!myShip && <p style={{marginTop: 0}} className="App-pulse">Connecting your Urbit ship with the <a className="App-link" target="_blank" rel="noreferrer noopener" href="https://chrome.google.com/webstore/detail/urbit-visor/oadimaacghcacmfipakhadejgalcaepg">Urbit Visor</a> web extension...</p>}
        {myShip && !location && <p style={{marginTop: 0}} className="App-pulse"><span className="App-link">~{myShip}</span> Please share your location...</p>}
        {myShip && location && !authorized && <p style={{marginTop: 0}} className="App-pulse"> <span className="App-link">~{myShip}</span> Authorizing your ship...</p>}
        {<MapContainer attributionControl={false} center={[35, -95]} zoom={2.5} style={{height: 384, width: "95%"}} whenCreated={(map) => {fetchShips(map);}}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/></MapContainer>}
        {selectedShip && ships && ships[ships.findIndex((ship => ship.name === selectedShip))] && <table style={{marginTop: '1em'}} className="App-pulse"><tbody><tr style={{cursor: 'pointer'}} onClick={() => {const shipIndex = ships.findIndex((ship => ship.name === selectedShip)); if(shipIndex !== -1) { map.setView(new L.LatLng(ships[shipIndex].location.split(",")[0], ships[shipIndex].location.split(",")[1]), 18); setSelectedShip(ships[shipIndex].name); setDragged(false); } }}><td>{sigil({ patp: selectedShip, renderer: reactRenderer, size: 50, colors: ['black', ships[ships.findIndex((ship => ship.name === selectedShip))].status] })}</td><td>&nbsp;~{selectedShip}</td></tr></tbody></table>}
        {<hr className="App-link" style={{width: "95%"}}></hr>}
        {ships && <div><table><tbody>{ships.sort(function(a, b) { return b.updatedAt.localeCompare(a.updatedAt);}).map(function(ship, idx){return (selectedShip !== ship.name && <tr style={{cursor: 'pointer'}} onClick={() => {map.setView(new L.LatLng(ship.location.split(",")[0], ship.location.split(",")[1]), 18); setSelectedShip(ship.name); setDragged(false);}} key={idx}><td>{sigil({ patp: ship.name, renderer: reactRenderer, size: 50, colors: ['black', ship.status] })}</td><td>&nbsp;~{ship.name}</td></tr>)})}</tbody></table></div>}
        {<hr className="App-link" style={{width: "95%", marginBottom: 0}}></hr>}
        {<p><span className="App-link">Urbit Tile 2022</span></p>}
      </div>
    </div>
  );
}

export default App; 