import React, { PureComponent } from 'react';
import { HorizontalGroup, Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './DataSource';
import { Device } from './types/AkenzaTypes';
import { AkenzaDataSourceConfig, AkenzaQuery } from './types/PluginTypes';
import { QueryEditorState } from './types/Utils';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

type Props = QueryEditorProps<DataSource, AkenzaQuery, AkenzaDataSourceConfig>;
interface Callback {
    (): void;
}

export class QueryEditor extends PureComponent<Props, QueryEditorState> {
    private initialLoadingComplete = false;
    private dataSourceId: number;
    private masterSearch = new Subject<string>();
    private search = new Subject<string>();

    constructor(props: Props) {
        super(props);
        const query = this.props.query;
        // initialize the select values and their options if the panel has been saved before, will initialize empty otherwise
        const masterDeviceSelectValue = {
            label: query.masterDevice?.name || undefined,
            value: query.masterDeviceId || null,
            device: query.masterDevice,
        };
        const deviceSelectValue = {
            label: query.device?.name || undefined,
            value: query.deviceId || null,
            device: query.device,
        };
        const topicSelectValue = {
            label: query.topic,
            value: query.topic || null,
        };
        const dataKeySelectValue = {
            label: query.dataKey,
            value: query.dataKey || null,
        };
        // initialize the state
        this.state = {
            masterDeviceValue: masterDeviceSelectValue,
            masterDeviceOptions: [masterDeviceSelectValue],
            deviceValue: deviceSelectValue,
            deviceOptions: [deviceSelectValue],
            topicValue: topicSelectValue,
            topicOptions: [topicSelectValue],
            dataKeyValue: dataKeySelectValue,
            dataKeyOptions: [dataKeySelectValue],
            loadingMasterDevices: false,
            loadingDevices: false,
            loadingTopics: false,
            loadingDataKeys: false,
        };
        // other view initializations
        this.initializeDeviceSelection();
        this.initializeSearchInputSubscription();
        this.dataSourceId = this.props.datasource.id;
    }

    private initializeSearchInputSubscription(): void {
        const { query } = this.props;
        this.masterSearch
            // wait for 250ms after the user has finished typing
            .pipe(debounceTime(250), distinctUntilChanged())
            // subscribe and update the master device options
            .subscribe((searchString) => {
                this.loadMasterDevicesAndAssembleSelectionOptions(searchString, true);
            });
        this.search
            // wait for 250ms after the user has finished typing
            .pipe(debounceTime(250), distinctUntilChanged())
            // subscribe and update the device options
            .subscribe((searchString) => {
                if (query.masterDevice) {
                    let filter = '{"domain.id": "' + query.masterDevice.domain.id + '"}';
                    let masterDeviceId = query.masterDevice.id;
                    this.loadDevicesAndAssembleSelectionOptions(searchString, true, undefined, filter, masterDeviceId);
                }
            });
    }

    private initializeDeviceSelection(): void {
        const { query } = this.props;
        // render() is called multiple times, in order to avoid spam calling our API this check has been put into place
        if (
            !this.state.loadingMasterDevices &&
            !this.state.loadingDevices &&
            this.dataSourceId !== this.props.datasource.id
        ) {
            if (this.dataSourceId !== this.props.datasource.id && this.initialLoadingComplete) {
                this.resetAllValues();
                this.dataSourceId = this.props.datasource.id;
            }
            // load the device list
            this.loadMasterDevicesAndAssembleSelectionOptions(undefined, false, () => {
                // query contains values if the panel was saved at some point, meaning the topic and data key selection should be loaded as well
                if (query.masterDeviceId && query.deviceId && query.topic) {
                    let filter = '{"domain.id": "' + query.masterDevice!.domain.id + '"}';
                    this.loadDevicesAndAssembleSelectionOptions(
                        undefined,
                        false,
                        () => {
                            this.loadTopicsAndAssembleSelectionOptions(query.deviceId!, () => {
                                this.loadDataKeysAndAssembleSelectionOptions(query.deviceId!, query.topic!, () => {
                                    // set the initial loading state once everything has been loaded
                                    this.initialLoadingComplete = true;
                                });
                            });
                        },
                        filter,
                        query.masterDeviceId
                    );
                } else {
                    this.initialLoadingComplete = true;
                }
            });
        }
    }

    private loadMasterDevicesAndAssembleSelectionOptions(
        searchString?: string,
        skipStateUpdate?: boolean,
        callback?: Callback
    ) {
        // the loading state should not be shown under certain circumstances
        if (!skipStateUpdate) {
            this.setLoadingMasterDevicesState(true);
        }

        this.props.datasource.getMasterDeviceType().then((masterDeviceType) => {
            const filter = '{"deviceType.id": "' + masterDeviceType.id + '"}';
            this.props.datasource.getDevices(searchString, filter).then(
                (devices: Device[]) => {
                    const masterDeviceSelectOptions: Array<SelectableValue<string>> = [];
                    for (const device of devices) {
                        masterDeviceSelectOptions.push({ label: device.name, value: device.id, device });
                    }
                    // modify the state
                    this.setState((prevState) => ({
                        ...prevState,
                        masterDeviceOptions: masterDeviceSelectOptions,
                    }));
                    // execute the callback if set
                    if (callback) {
                        callback();
                    }
                    this.setLoadingMasterDevicesState(false);
                },
                // in case an error is thrown, stop the loading animation
                () => {
                    this.setLoadingMasterDevicesState(false);
                }
            );
        });
    }

    private loadDevicesAndAssembleSelectionOptions(
        searchString?: string,
        skipStateUpdate?: boolean,
        callback?: Callback,
        filter?: string,
        masterDeviceId?: string
    ) {
        // the loading state should not be shown under certain circumstances
        if (!skipStateUpdate) {
            this.setLoadingDevicesState(true);
        }

        this.props.datasource.getDevices(searchString, filter, masterDeviceId).then(
            (devices: Device[]) => {
                const deviceSelectOptions: Array<SelectableValue<string>> = [];
                for (const device of devices) {
                    deviceSelectOptions.push({ label: device.name, value: device.id, device });
                }
                // modify the state
                this.setState((prevState) => ({
                    ...prevState,
                    deviceOptions: deviceSelectOptions,
                }));
                // execute the callback if set
                if (callback) {
                    callback();
                }
                this.setLoadingDevicesState(false);
            },
            // in case an error is thrown, stop the loading animation
            () => {
                this.setLoadingDevicesState(false);
            }
        );
    }

    private loadTopicsAndAssembleSelectionOptions(deviceId: string, callback?: Callback): void {
        this.setLoadingTopicsState(true);
        this.props.datasource.getTopics(deviceId).then(
            (topics: string[]) => {
                let topicsSelectOptions: Array<SelectableValue<string>> = [];
                for (const topic of topics) {
                    topicsSelectOptions.push({ label: topic, value: topic });
                }
                if (this.initialLoadingComplete) {
                    // reset the values only after initial loading was completed, will reset it again otherwise due to react lifecycles
                    this.resetTopicAndDataKeyValues(topicsSelectOptions);
                } else {
                    // on first load just set the available options
                    this.setState((prevState) => ({
                        ...prevState,
                        topicOptions: topicsSelectOptions,
                    }));
                }

                if (callback) {
                    callback();
                }
                this.setLoadingTopicsState(false);
            },
            () => {
                // in case an error is thrown, stop the loading animation
                this.setLoadingTopicsState(false);
            }
        );
    }

    private loadDataKeysAndAssembleSelectionOptions(deviceId: string, topic: string, callback?: Callback): void {
        this.setLoadingDataKeysState(true);
        this.props.datasource.getKeys(deviceId, topic).then(
            (keys: string[]) => {
                let keySelectOptions: Array<SelectableValue<string>> = [];
                for (const key of keys) {
                    keySelectOptions.push({ label: key, value: key });
                }
                if (this.initialLoadingComplete) {
                    // reset the values only after initial loading was completed, will reset it again otherwise due to react lifecycles
                    this.setState((prevState) => ({
                        ...prevState,
                        dataKeyOptions: keySelectOptions,
                        dataKeyValue: {},
                    }));
                } else {
                    // on first load just set the available options
                    this.setState((prevState) => ({
                        ...prevState,
                        dataKeyOptions: keySelectOptions,
                    }));
                }
                if (callback) {
                    callback();
                }
                this.setLoadingDataKeysState(false);
            },
            () => {
                // in case an error is thrown, stop the loading animation
                this.setLoadingDataKeysState(false);
            }
        );
    }

    render() {
        const {
            loadingMasterDevices,
            loadingDevices,
            loadingTopics,
            loadingDataKeys,
            masterDeviceOptions,
            masterDeviceValue,
            deviceOptions,
            deviceValue,
            dataKeyOptions,
            dataKeyValue,
            topicOptions,
            topicValue,
        } = this.state;
        const { query } = this.props;

        return (
            <div className="gf-form">
                <HorizontalGroup spacing={'md'} wrap={true}>
                    <HorizontalGroup spacing={'none'}>
                        <div className="gf-form-label">Master Device:</div>
                        <Select
                            menuPlacement={'bottom'}
                            isLoading={loadingMasterDevices}
                            placeholder={'Select a master device'}
                            noOptionsMessage={'No master devices available'}
                            options={masterDeviceOptions}
                            value={masterDeviceValue}
                            onChange={this.onMasterDeviceSelectionChange}
                            width={48}
                            onInputChange={this.onMasterDeviceInputChange}
                        />
                    </HorizontalGroup>
                    <HorizontalGroup spacing={'none'}>
                        <div className="gf-form-label">Valve:</div>
                        <Select
                            menuPlacement={'bottom'}
                            disabled={!query.masterDeviceId}
                            isLoading={loadingDevices}
                            placeholder={'Select a device'}
                            noOptionsMessage={'No devices available'}
                            options={deviceOptions}
                            value={deviceValue}
                            onChange={this.onDeviceSelectionChange}
                            width={48}
                            onInputChange={this.onDeviceInputChange}
                        />
                    </HorizontalGroup>
                    <HorizontalGroup spacing={'none'}>
                        <div className="gf-form-label">Topic:</div>
                        <Select
                            menuPlacement={'bottom'}
                            disabled={!query.deviceId}
                            isLoading={loadingTopics}
                            placeholder={'Select a topic'}
                            noOptionsMessage={'No topics available'}
                            options={topicOptions}
                            value={topicValue}
                            onChange={this.onTopicSelectionChange}
                            width={24}
                        />
                    </HorizontalGroup>
                    <HorizontalGroup spacing={'none'}>
                        <div className="gf-form-label">Data Key:</div>
                        <Select
                            menuPlacement={'bottom'}
                            disabled={!query.topic}
                            isLoading={loadingDataKeys}
                            placeholder={'Select a data key'}
                            noOptionsMessage={'No data keys available'}
                            options={dataKeyOptions}
                            value={dataKeyValue}
                            onChange={this.onDataKeySelectionChange}
                            width={24}
                        />
                    </HorizontalGroup>
                </HorizontalGroup>
            </div>
        );
    }

    onMasterDeviceInputChange = (searchString: string): void => {
        // only set the loading state if the search string is present
        // due to react lifecycles this triggers if the user leaves the input field (which loads the initial list again)
        // in order to not show the loading indicator at that point, it is simply not modified if the search string is empty
        if (searchString) {
            this.setLoadingDevicesState(true);
        }
        // emit the search string in the search subject
        this.masterSearch.next(searchString);
    };

    onDeviceInputChange = (searchString: string): void => {
        // only set the loading state if the search string is present
        // due to react lifecycles this triggers if the user leaves the input field (which loads the initial list again)
        // in order to not show the loading indicator at that point, it is simply not modified if the search string is empty
        if (searchString) {
            this.setLoadingDevicesState(true);
        }
        // emit the search string in the search subject
        this.search.next(searchString);
    };

    onMasterDeviceSelectionChange = (masterDeviceSelection: SelectableValue<string>): void => {
        const { query } = this.props;
        // check if the same value was selected again (no need to re-trigger any updates in this case)
        if (masterDeviceSelection?.value !== query.masterDeviceId) {
            this.resetDeviceTopicAndDataKeyValues(masterDeviceSelection);
            this.loadDevicesAndAssembleSelectionOptions(
                undefined,
                undefined,
                undefined,
                '{"domain.id": "' + masterDeviceSelection.device.domain.id + '"}',
                masterDeviceSelection.device.id
            );
        }
    };

    onDeviceSelectionChange = (deviceSelection: SelectableValue<string>): void => {
        const { query } = this.props;
        // check if the same value was selected again (no need to re-trigger any updates in this case)
        if (deviceSelection?.value !== query.deviceId) {
            this.setDeviceValueAndResetTopicAndDataKeyValues(deviceSelection);
            this.loadTopicsAndAssembleSelectionOptions(deviceSelection.value!);
        }
    };

    onTopicSelectionChange = (topicSelection: SelectableValue<string>): void => {
        const { onChange, query, onRunQuery } = this.props;
        // check if the same value was selected again (no need to re-trigger any updates in this case)
        if (topicSelection?.value !== query.topic) {
            // modify the query
            onChange({
                ...query,
                topic: topicSelection.value,
            });
            // modify the state
            this.setState((prevState) => ({
                ...prevState,
                topicValue: topicSelection,
            }));
            // load data keys if the topic and the deviceId are present
            if (topicSelection.value && query.deviceId) {
                this.loadDataKeysAndAssembleSelectionOptions(query.deviceId, topicSelection.value);
            }
            // execute the query
            onRunQuery();
        }
    };

    onDataKeySelectionChange = (dataKeySelection: SelectableValue<string>): void => {
        const { onChange, query, onRunQuery } = this.props;
        // check if the same value was selected again (no need to re-trigger any updates in this case)
        if (dataKeySelection?.value !== query.dataKey) {
            // modify the query
            onChange({
                ...query,
                dataKey: dataKeySelection.value,
            });
            // modify the state
            this.setState((prevState) => ({
                ...prevState,
                dataKeyValue: dataKeySelection,
            }));
            // execute the query
            onRunQuery();
        }
    };

    private resetAllValues() {
        const { onChange, query } = this.props;
        // modify the query
        onChange({
            ...query,
            masterDeviceId: '',
            masterDevice: undefined,
            deviceId: '',
            device: undefined,
            topic: '',
            dataKey: '',
        });
        // reset the state
        this.setState({
            masterDeviceValue: {},
            deviceValue: {},
            masterDeviceOptions: [],
            deviceOptions: [],
            topicValue: {},
            topicOptions: [],
            dataKeyValue: {},
            dataKeyOptions: [],
        });
    }

    private resetDeviceTopicAndDataKeyValues(masterSelection: SelectableValue<string>) {
        const { onChange, query, onRunQuery } = this.props;

        onChange({
            ...query,
            masterDeviceId: masterSelection.value,
            masterDevice: masterSelection.device,
            deviceId: '',
            device: undefined,
            topic: '',
            dataKey: '',
        });
        // execute the query
        onRunQuery();

        this.setState((prevState) => ({
            ...prevState,
            masterDeviceValue: masterSelection,
            deviceValue: {},
            deviceOptions: [],
            topicValue: {},
            topicOptions: [],
            dataKeyValue: {},
            dataKeyOptions: [],
        }));
    }

    private setDeviceValueAndResetTopicAndDataKeyValues(deviceSelection: SelectableValue<string>) {
        const { onChange, query, onRunQuery } = this.props;

        onChange({
            ...query,
            deviceId: deviceSelection?.value,
            device: deviceSelection?.device,
            topic: '',
            dataKey: '',
        });
        // execute the query
        onRunQuery();

        this.setState((prevState) => ({
            ...prevState,
            deviceValue: deviceSelection,
            topicValue: {},
            topicOptions: [],
            dataKeyValue: {},
            dataKeyOptions: [],
        }));
    }

    private resetTopicAndDataKeyValues(topicOptions: Array<SelectableValue<string>>) {
        const { onChange, query, onRunQuery } = this.props;

        onChange({
            ...query,
            topic: '',
            dataKey: '',
        });
        // execute the query
        onRunQuery();

        this.setState((prevState) => ({
            ...prevState,
            topicValue: {},
            topicOptions: topicOptions,
            dataKeyValue: {},
            dataKeyOptions: [],
        }));
    }

    private setLoadingMasterDevicesState(isLoading: boolean) {
        this.setState((prevState) => ({
            ...prevState,
            loadingMasterDevices: isLoading,
        }));
    }

    private setLoadingDevicesState(isLoading: boolean) {
        this.setState((prevState) => ({
            ...prevState,
            loadingDevices: isLoading,
        }));
    }

    private setLoadingTopicsState(isLoading: boolean) {
        this.setState((prevState) => ({
            ...prevState,
            loadingTopics: isLoading,
        }));
    }

    private setLoadingDataKeysState(isLoading: boolean) {
        this.setState((prevState) => ({
            ...prevState,
            loadingDataKeys: isLoading,
        }));
    }
}
