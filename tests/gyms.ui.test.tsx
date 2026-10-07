import React from 'react';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Linking } from 'react-native';
vi.mock('expo-router', () => ({ Link: ({children,href}: React.PropsWithChildren<{href:string}>) => <a href={href}>{children}</a>, usePathname: () => '/gyms' }));
vi.mock('@expo/vector-icons', () => ({Ionicons: () => null}));
vi.mock('expo-location', () => ({requestForegroundPermissionsAsync: vi.fn(async () => ({granted:false})), hasServicesEnabledAsync: vi.fn(async () => true), getLastKnownPositionAsync: vi.fn(async () => null), getCurrentPositionAsync: vi.fn(), Accuracy: {Balanced:3}}));
vi.mock('../src/services/api', () => ({publicAPI: vi.fn(async () => ({gyms:[],mode:'area'}))}));
import Gyms from '../src/app/gyms';
import * as Location from 'expo-location';
import { publicAPI } from '../src/services/api';
import { gymLocation } from '../src/services/gym-location';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://test.invalid'); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });
test('no location or provider request before consent and explicit action', () => {
 render(<Gyms/>);
 fireEvent.click(screen.getByRole('button',{name:'Use my current location'}));
 expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
 expect(publicAPI).not.toHaveBeenCalled();
});
test('denied location permission supports manual area instead', async () => {
 render(<Gyms/>);
 fireEvent.click(screen.getByRole('checkbox',{name:/Allow my search/}));
 fireEvent.click(screen.getByRole('button',{name:'Use my current location'}));
 await screen.findByText(/permission was declined/);
 expect(publicAPI).not.toHaveBeenCalled();
 expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Area, city or ZIP code'),{target:{value:'Austin, TX'}});
 fireEvent.click(screen.getByRole('button',{name:'Search this area'}));
 await screen.findByText(/No listed gyms found/);
 expect(publicAPI).toHaveBeenCalledWith('/gyms/search',{area:'Austin, TX'});
});
test('a recent approximate location avoids waiting for a new GPS fix', async () => {
 vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({granted:true} as Location.LocationPermissionResponse);
 vi.mocked(Location.getLastKnownPositionAsync).mockResolvedValueOnce({coords:{latitude:30.27,longitude:-97.74}} as Location.LocationObject);
 render(<Gyms/>);
 fireEvent.click(screen.getByRole('checkbox',{name:/Allow my search/}));
 fireEvent.click(screen.getByRole('button',{name:'Use my current location'}));
 await screen.findByText('0 gyms found');
 expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
 expect(publicAPI).toHaveBeenCalledWith('/gyms/search',{center:{latitude:30.27,longitude:-97.74},radius:5000});
 await screen.findByText(/recent approximate location/);
});
test('disabled location services give an immediate area-search option', async () => {
 vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({granted:true} as Location.LocationPermissionResponse);
 vi.mocked(Location.hasServicesEnabledAsync).mockResolvedValueOnce(false);
 await expect(gymLocation()).rejects.toThrow(/Location services are off/);
 expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});
test('a fresh GPS request is bounded and gives manual search guidance on timeout', async () => {
 vi.useFakeTimers();
 vi.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValueOnce({granted:true} as Location.LocationPermissionResponse);
 vi.mocked(Location.getCurrentPositionAsync).mockImplementationOnce(() => new Promise(() => {}));
 const outcome = expect(gymLocation()).rejects.toThrow(/city or ZIP code/);
 await vi.advanceTimersByTimeAsync(31000);
 await outcome;
});
test('without an in-app service, search opens real Maps results without waiting for GPS', async () => {
 vi.stubEnv('EXPO_PUBLIC_API_URL','');
 const open=vi.spyOn(Linking,'openURL').mockResolvedValue(undefined);
 render(<Gyms/>);
 fireEvent.click(screen.getByRole('checkbox',{name:/Allow my search/}));
 fireEvent.change(screen.getByLabelText('Area, city or ZIP code'),{target:{value:'Austin, TX'}});
 fireEvent.click(screen.getByRole('button',{name:'Search this area'}));
 await screen.findByText(/Search opened in Google Maps/);
 expect(open).toHaveBeenCalledWith(expect.stringContaining('gyms%20in%20Austin'));
 expect(publicAPI).not.toHaveBeenCalled();
 expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});
