import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { Device } from './AkenzaTypes';

export interface AkenzaQuery extends DataQuery {
    masterDeviceId?: string;
    masterDevice?: Device;
    deviceId?: string;
    device?: Device;
    topic?: string;
    dataKey?: string;
}

export interface AkenzaDataSourceConfig extends DataSourceJsonData {
    baseUrl: string;
    apiKey: string;
}
