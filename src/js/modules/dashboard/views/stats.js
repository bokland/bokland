/* global define */
define(function (require) {
    'use strict';

    // imports
    var $                   = require('jquery'),
        _                   = require('underscore'),
        config              = require('config/api'),
        bootstrap           = require('bootstrap'),
        BaseView            = require('libs/view'),
        FilterWidget        = require('components/filter/filterwidget'),
        AllDashboardsModel  = require('modules/dashboard/models/dashboards'),
        TemplateMetaModel   = require('modules/dashboard/models/templatemeta'),
        TemplateRow         = require('components/template/templaterow'),
        AddRowDialog        = require('components/template/addrow'),
        ExportDialog        = require('components/template/export'),
        CubeModel           = require('../models/cube'),
        WidgetBuilder       = require('components/widget-builder/builder'),
        templates           = require('templates/templates');


    // code
    var View = BaseView.extend({
        template: templates['modules/dashboard/stats'],
        rowTemplate: templates['components/template/row'],

        elementsUI: {
            'filterPopover': '[data-toggle=popover]',
            'dashboardTitle': '[data-region=title]',
            'selectDashboard': '[data-action=select-dashboard]',
            'saveDashboard': '[data-action=save-dashboard]',
            'createDashboard': '[data-action=create-dashboard]',
            'removeDashboard': '[data-action=remove-dashboard]',
            'addRowButton': '.btn-show-add-row-dialog'
        },

        events: {
            'change @ui.dashboardTitle' : '_changeDashboardTitle',
            'change @ui.selectDashboard' : '_changeDashboard',
            'click @ui.saveDashboard' : '_saveDashboard',
            'click @ui.createDashboard' : '_createDashboard',
            'click @ui.removeDashboard' : '_removeDashboard',
            'click @ui.addRowButton' : '_showAddRowDialog'
        },

        widgetBilderView: null,
        rows: [],

        initialize: function (options) {
            var _this = this;

            _this.metaModel = new TemplateMetaModel();
            _this.dashboards = new AllDashboardsModel();
            _this.cube = new CubeModel();

            _this.listenToOnce(_this.cube, 'sync', _this._cubeLoaded);
            _this.listenToOnce(_this.dashboards, 'sync', _this._loadDashboard);

            _this.listenToOnce(_this.metaModel, 'sync', _this.redraw);
            _this.listenTo(_this.metaModel, 'rowadded', _this._addRow);
            _this.listenTo(_this.metaModel, 'rowremoved', _this._removeRow);
            _this.listenTo(_this.collection, 'sync', _this._refresh);

            _this.dashboards.fetch();
            _this.cube.fetch();
        },

        _loadDashboard: function () {
            var _this = this,
                dashboards = _this.dashboards.get('dashboards'),
                defaultDashboard = dashboards[0],
                selectedDashboardId = _this.state.get('did');

            if (!defaultDashboard) {
                _this._createDashboard();
            } else {
                _this.metaModel.set('id', selectedDashboardId ? selectedDashboardId : defaultDashboard.id);

                _this.ui.$selectDashboard.find('option').remove();
                _.each(dashboards, function (dash) {
                    if (dash) {
                        _this.ui.$selectDashboard.append('<option value="' + dash.id + '"' + (selectedDashboardId === dash.id ? 'selected' : '') + '>' + dash.title + '</option>');
                    }

                });

                var onSuccess = function () {
                    if (selectedDashboardId) {
                        _this.state.trigger('change');
                    } else {
                        _this.state.set({did: defaultDashboard.id});
                    }
                };

                _this._loadMeta(onSuccess);
            }
        },

        _loadMeta: function (success) {
            var _this = this;

            _this.metaModel.fetch({success: success});
        },

        _removeDashboard: function (ev) {
            var _this = this;
            ev.preventDefault();

            _this.ui.$selectDashboard.find('[value=' + _this.metaModel.get('id') + ']').remove();
            _this.metaModel.sync('delete', _this.metaModel);

            if (!_this.ui.$selectDashboard.find('option:first').val()) {
                _this._createDashboard();
            } else {
                _this._changeDashboard();
            }

        },

        render: function () {
            var _this = this;

            _this.$el.html(_this.template({}));
            _this.bindUI();

            var filterWidget = new FilterWidget({
                state: _this.state
            });
            _this.region('filter').show(filterWidget);

            _this.addRowDialog = new AddRowDialog({
                model: _this.metaModel
            });
            _this.region('add-row').show(_this.addRowDialog);

            var exportDialog = new ExportDialog({
                state: _this.state
            });
            _this.region('export-data').show(exportDialog);

            return _this;
        },

        redraw: function () {
            var _this = this;

            _this.ui.$dashboardTitle.val(_this.metaModel.get('title'));

            _this.$el.find('[data-region="rows"]').empty();

            _.each(_this.rows, function (row, i) {
                row.clearCells();
                row.dispose();
            });
            _this.rows.length = 0;

            _.each(_this.metaModel.get('rows'), function (row, i) {
                _this._addRow(i);
            });
        },

        _refresh: function(){
            setTimeout(function(){ $('body').hide().show(); }, 500);
        },

        _addRow: function (rowNum) {
            var _this = this,
                rowInd = _.isUndefined(rowNum) ? (_this.metaModel.get('rows').length - 1) : rowNum;

            var rowElement = new TemplateRow({
                metaModel: _this.metaModel,
                cube: _this.cube,
                rowNum: rowInd,
                rowMeta: _this.metaModel.get('rows')[rowInd],
                collection: _this.collection,
                builderView: _this.widgetBilderView,
                editRowView: _this.addRowDialog,
                state: _this.state
            });

            _this.rows.push(rowElement);

            _this.$el.find('[data-region="rows"]').append(rowElement.$el);

            rowElement.render();
        },

        _removeRow: function(rowNum) {
            var _this = this,
                rowMetaModel = _this.metaModel.get('rows');

            rowMetaModel.splice(rowNum, 1);
            _this.rows.splice(rowNum, 1);

            _this.metaModel.set('rows', rowMetaModel);
            _this._saveDashboard();
        },

        _changeDashboardTitle: function () {
            var _this = this,
                title = _this.ui.$dashboardTitle.val();

            _this.ui.$selectDashboard.find('[value=' + _this.metaModel.get('id') + ']').text(title);
        },

        _cubeLoaded: function () {
            var _this = this;

            _this.widgetBilderView = new WidgetBuilder({
                cube: _this.cube
            });
            _this.region('widget-builder').show(_this.widgetBilderView);
        },

        _createDashboard: function () {
            var _this = this;

            /* jshint camelcase:false */
            _this.metaModel = new TemplateMetaModel({title: 'New dashboard', app_id: 'new'});
            /* jshint camelcase:true */
            _this.metaModel.save(null, {
                success: function (model, response) {
                    if (response.data) {
                        _this.state.set({did: response.data._id}, {silent: true});
                        model.set('id', response.data._id);
                    }
                    _this.listenToOnce(_this.metaModel, 'sync', _this.redraw);
                    _this.listenToOnce(_this.dashboards, 'sync', _this._loadDashboard);
                    _this.dashboards.fetch();
                }});
        },

        _saveDashboard: function () {
            var _this = this;
            _this.metaModel.set('title', _this.ui.$dashboardTitle.val());
            if (!config.stubs) {
                _this.metaModel.save(null, {success: function (model, response) {
                    model.set('id', (response || {data: {}}).data._id);
                }});
            }
        },

        _changeDashboard: function () {
            var _this = this,
                selectedDashboardId = _this.ui.$selectDashboard.find(':selected').val();

            _this.metaModel.set('id', selectedDashboardId);

            var onSuccess = function () {
                _this.state.set('did', selectedDashboardId);
                _this.redraw();
            };

            _this._loadMeta(onSuccess);

        },

        _showAddRowDialog: function () {
            var _this = this;

            if(_this.addRowDialog) {
                _this.addRowDialog.reinit({
                });
            }
        }

    });

    return View;
});