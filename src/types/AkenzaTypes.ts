export interface Device {
    id: string;
    name: string;
    domain: Domain;
    // no other properties since the API call is made using the fields param
}

export interface Domain {
    id: string;
    // other properties omitted
}

export interface DeviceList {
    offset: number;
    limit: number;
    total: number;
    data: Device[];
}

export interface DeviceData {
    deviceId: string;
    timestamp: string;
    topic: string;
    data: any;
}

export interface TimeSeriesData {
    dataPoints: any[];
    key: string;
}

export interface Environment {
    id: string;
    name: string;
    // other properties omitted
}

export interface DeviceType {
    id: string;
    name: string;
    // other properties omitted
}

export interface EnvironmentList {
    offset: number;
    limit: number;
    total: number;
    data: Environment[];
}

export interface DeviceTypeList {
    offset: number;
    limit: number;
    total: number;
    data: DeviceType[];
}
