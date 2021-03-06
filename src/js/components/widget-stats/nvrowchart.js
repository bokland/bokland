/* global define */
define(function (require) {
    'use strict';

    // imports
    var _ = require('underscore'),
        d3 = require('d3'),
        nv = require('nvd3'),
        $ = require('jquery'),
        NvWidget = require('./nvwidget'),
        templates = require('templates/templates');

    var View = NvWidget.extend({

        parseData: function (data) {
            var _this = this;

            var row = _this.widgetModel.get('rows')[0];
            var rowAgg = row.aggregation;
            var rowName = row.dimension.field;
            var seriesName = _this.widgetModel.get('rows')[1] ? _this.widgetModel.get('rows')[1].dimension.field : undefined;
            var seriesAgg = (_this.widgetModel.get('rows')[1] || {}).aggregation;

            var measureName = _this.widgetModel.get('measures')[0];

            function parseSeries(series, key) {
                var values = _.map(series, function (d) {
                    return {
                        value: d[measureName],
                        label: _this.cube.dimensionValueLabel(rowName, d[rowName], rowAgg)
                    };
                });

                values = _.sortBy(values, function(d){
                    return d.label;
                });

                return {
                    key: seriesName ? _this.cube.dimensionValueLabel(seriesName, key, seriesAgg) : undefined,
                    values: values
                };
            }

            if (seriesName) {
                var series = _.groupBy(data, function (d) {
                    return d[seriesName];
                });
                return _.map(series, function (value, key) {
                    return parseSeries(value, key);
                });
            } else {
                return [ parseSeries(data) ];
            }
        },

        createChart: function () {
            return nv.models.multiBarHorizontalChart()
                .x(function (d) {
                    return d.label;
                })
                .y(function (d) {
                    return d.value;
                })
                .showValues(true)
                .tooltips(false)
                .color(this.COLORS)
                .showControls(false);
        }

    });

    return View;
});