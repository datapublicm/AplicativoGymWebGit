import {Geolocation} from '@capacitor/geolocation';
window.GymNativeGPS={
 async getCurrentPosition(){
  const granted=await Geolocation.checkPermissions();
  if(granted.location!=='granted'&&granted.coarseLocation!=='granted'){
   const requested=await Geolocation.requestPermissions();
   if(requested.location!=='granted'&&requested.coarseLocation!=='granted')
    throw Error('Debes permitir la ubicación de GymLytics en Android.');
  }
  return Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:25000,maximumAge:0});
 }
};