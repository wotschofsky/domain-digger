import type { LatLngExpression } from 'leaflet';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';

const LocationMap = ({ location }: { location: LatLngExpression }) => (
  <MapContainer center={location} zoom={4}>
    <TileLayer
      attribution='&copy; <a href="http://osm.org/copyright" rel="noreferrer">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <Marker position={location} />
  </MapContainer>
);

export default LocationMap;
