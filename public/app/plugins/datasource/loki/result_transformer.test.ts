import { CircularDataFrame, FieldType } from '@grafana/data';
import { LokiStreamResult, LokiTailResponse } from './types';
import * as ResultTransformer from './result_transformer';

const streamResult: LokiStreamResult[] = [
  {
    stream: {
      foo: 'bar',
    },
    values: [['1579857562021616000', "foo: [32m'bar'[39m"]],
  },
  {
    stream: {
      bar: 'foo',
    },
    values: [['1579857562031616000', "bar: 'foo'"]],
  },
];

describe('loki result transformer', () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('lokiStreamResultToDataFrame', () => {
    it('converts streams to series', () => {
      const data = streamResult.map(stream => ResultTransformer.lokiStreamResultToDataFrame(stream));

      expect(data.length).toBe(2);
      expect(data[0].fields[1].labels!['foo']).toEqual('bar');
      expect(data[0].fields[0].values.get(0)).toEqual('2020-01-24T09:19:22.021Z');
      expect(data[0].fields[1].values.get(0)).toEqual(streamResult[0].values[0][1]);
      expect(data[0].fields[2].values.get(0)).toEqual('2b431b8a98b80b3b2c2f4cd2444ae6cb');
      expect(data[1].fields[0].values.get(0)).toEqual('2020-01-24T09:19:22.031Z');
      expect(data[1].fields[1].values.get(0)).toEqual(streamResult[1].values[0][1]);
      expect(data[1].fields[2].values.get(0)).toEqual('75d73d66cff40f9d1a1f2d5a0bf295d0');
    });
  });

  describe('lokiStreamsToDataframes', () => {
    it('should enhance data frames', () => {
      jest.spyOn(ResultTransformer, 'enhanceDataFrame');
      const dataFrames = ResultTransformer.lokiStreamsToDataframes(streamResult, { refId: 'B' }, 500, {
        derivedFields: [
          {
            matcherRegex: 'trace=(w+)',
            name: 'test',
            url: 'example.com',
          },
        ],
      });

      expect(ResultTransformer.enhanceDataFrame).toBeCalled();
      dataFrames.forEach(frame => {
        expect(
          frame.fields.filter(field => field.name === 'test' && field.type === 'string').length
        ).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('appendResponseToBufferedData', () => {
    it('should return a dataframe with ts in iso format', () => {
      const tailResponse: LokiTailResponse = {
        streams: [
          {
            stream: {
              filename: '/var/log/grafana/grafana.log',
              job: 'grafana',
            },
            values: [
              [
                '1581519914265798400',
                't=2020-02-12T15:04:51+0000 lvl=info msg="Starting Grafana" logger=server version=6.7.0-pre commit=6f09bc9fb4 branch=issue-21929 compiled=2020-02-11T20:43:28+0000',
              ],
            ],
          },
        ],
      };

      const data = new CircularDataFrame({ capacity: 1 });
      data.addField({ name: 'ts', type: FieldType.time, config: { title: 'Time' } });
      data.addField({ name: 'tsNs', type: FieldType.time, config: { title: 'Time ns' } });
      data.addField({ name: 'line', type: FieldType.string }).labels = { job: 'grafana' };
      data.addField({ name: 'labels', type: FieldType.other });
      data.addField({ name: 'id', type: FieldType.string });

      ResultTransformer.appendResponseToBufferedData(tailResponse, data);
      expect(data.get(0)).toEqual({
        ts: '2020-02-12T15:05:14.265Z',
        tsNs: '1581519914265798400',
        line:
          't=2020-02-12T15:04:51+0000 lvl=info msg="Starting Grafana" logger=server version=6.7.0-pre commit=6f09bc9fb4 branch=issue-21929 compiled=2020-02-11T20:43:28+0000',
        labels: { filename: '/var/log/grafana/grafana.log' },
        id: '19e8e093d70122b3b53cb6e24efd6e2d',
      });
    });
  });
});
