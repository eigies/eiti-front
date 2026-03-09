import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

interface OpenMeteoResponse {
    current: {
        temperature_2m: number;
        apparent_temperature: number;
        weather_code: number;
        is_day: number;
    };
}

export interface WeatherSnapshot {
    temperature: number;
    apparentTemperature: number;
    description: string;
    isDay: boolean;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
    constructor(private http: HttpClient) { }

    getCurrentWeather(latitude: number, longitude: number): Observable<OpenMeteoResponse> {
        const params = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude),
            current: 'temperature_2m,apparent_temperature,weather_code,is_day',
            timezone: 'auto'
        });

        return this.http.get<OpenMeteoResponse>(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    }

    describe(code: number): string {
        const map: Record<number, string> = {
            0: 'Despejado',
            1: 'Mayormente despejado',
            2: 'Parcialmente nublado',
            3: 'Nublado',
            45: 'Neblina',
            48: 'Neblina con escarcha',
            51: 'Llovizna ligera',
            53: 'Llovizna',
            55: 'Llovizna intensa',
            61: 'Lluvia ligera',
            63: 'Lluvia',
            65: 'Lluvia intensa',
            71: 'Nieve ligera',
            73: 'Nieve',
            75: 'Nieve intensa',
            80: 'Chubascos ligeros',
            81: 'Chubascos',
            82: 'Chubascos intensos',
            95: 'Tormenta',
            96: 'Tormenta con granizo',
            99: 'Tormenta severa'
        };

        return map[code] ?? 'Condicion variable';
    }
}
