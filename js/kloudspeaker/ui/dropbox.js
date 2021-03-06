define(['kloudspeaker/plugins', 'kloudspeaker/ui/views', 'kloudspeaker/events', 'kloudspeaker/ui', 'kloudspeaker/ui/dnd', 'kloudspeaker/ui/formatters', 'kloudspeaker/ui/controls', 'kloudspeaker/utils', 'kloudspeaker/dom'], function(plugins, views, events, ui, dnd, formatters, controls, utils, dom) {
    var that = this;
    that.w = 0;
    that.$dbE = false;
    that.items = [];
    that.itemsByKey = {};

    events.addEventHandler(function(e) {
        if (e.type == 'filesystem/delete') that.onRemoveItems(utils.extractValue(e.payload.items, "id"));
        //TODO else if (e.type == 'filesystem/rename') that.updateItems(kloudspeaker.helpers.extractValue(e.payload.items));
    });

    that._pathFormatter = new formatters.FilesystemItemPath();
    that.itemContext = new ui.itemContext();

    this.onFileViewActivate = function($container) {
        kloudspeaker.dom.template("kloudspeaker-tmpl-mainview-dropbox").appendTo($container);
        $("#kloudspeaker-dropbox-handle").click(function() {
            that.openDropbox();
        });

        that.$dbE = $("#kloudspeaker-dropbox");
        that.w = $("#kloudspeaker-dropbox-content").outerWidth();

        var onResize = function() {
            var y = $("#kloudspeaker-mainview-header").height();
            that.$dbE.css("top", y + "px").height($(window).height() - y);
        };
        $(window).resize(onResize);
        onResize();

        if (dnd) {
            var dndHandler = {
                canDrop: function($e, e, obj) {
                    if (!obj || obj.type != 'filesystemitem') return false;
                    var item = obj.payload;
                    return (that.items.indexOf(item) < 0);
                },
                dropType: function($e, e, obj) {
                    if (!obj || obj.type != 'filesystemitem') return false;
                    return "copy";
                },
                onDrop: function($e, e, obj) {
                    if (!obj || obj.type != 'filesystemitem') return;
                    var item = obj.payload;
                    that.onAddItem(item);
                }
            };
            dnd.enableDrop($("#kloudspeaker-dropbox-list"), dndHandler);
            dnd.enableDrop($("#kloudspeaker-dropbox-handle"), dndHandler);
        }

        var ab = controls.dropdown({
            element: $("#kloudspeaker-dropbox-actions"),
            container: $("body"),
            hideDelay: 0,
            dynamic: true,
            onShow: function(drp, items) {
                that.getActions(function(a) {
                    if (!a) {
                        drp.hide();
                        return;
                    }
                    drp.items(a);
                });
            },
            onItem: function(i, cbr) {
                if (cbr) cbr.done(that.emptyDropbox);
                else that.emptyDropbox();
            },
            onBlur: function(dd) {

            }
        });
        that._updateButton();
        that.openDropbox(false);
    };

    this.onFileViewDeactivate = function() {
        $("#kloudspeaker-dropbox").remove();
    };

    this.getActions = function(cb) {
        if (that.items.length === 0) {
            cb([]);
            return;
        }
        var actions = utils.getPluginActions(plugins.getItemCollectionPlugins(that.items, {
            src: "dropbox"
        }));
        actions.push({
            title: "-"
        });
        actions.push({
            "title-key": "dropboxEmpty"
        });
        cb(utils.cleanupActions(actions));
    };

    this.openDropbox = function(o) {
        var open = that.$dbE.hasClass("opened");
        if (window.def(o)) {
            if (o == open) return;
        } else {
            o = !open;
        }

        if (!o) that.$dbE.removeClass("opened").addClass("closed").animate({
            "width": "0"
        }, 300);
        else that.$dbE.addClass("opened").removeClass("closed").animate({
            "width": that.w + ""
        }, 300);
    };

    this.emptyDropbox = function() {
        that.items = [];
        that.itemsByKey = {};
        that.refreshList();
    };

    this.onAddItem = function(i) {
        that.openDropbox(true);
        var list = i;
        if (!window.isArray(i))
            list = [i];
        $.each(list, function(ind, item) {
            if (that.items.indexOf(item) >= 0) return;
            that.items.push(item);
            that.itemsByKey[item.id] = item;
        });
        that.refreshList();
        that._updateButton();
    };

    this.onRemoveItem = function(item) {
        that.items.remove(item);
        delete that.itemsByKey[item.id];
        that.refreshList();
        that._updateButton();
    };

    this.onRemoveItems = function(ids) {
        var count = 0;
        $.each(ids, function(i, id) {
            var item = that.itemsByKey[id];
            if (!item) return;

            that.items.remove(item);
            delete that.itemsByKey[id];
            count++;
        });
        if (count > 0) {
            that.refreshList();
            that._updateButton();
        }
    };

    this.refreshList = function() {
        $("#kloudspeaker-dropbox-list").empty().append(dom.template("kloudspeaker-tmpl-mainview-dropbox-item", that.items));
        var $items = $("#kloudspeaker-dropbox-list .kloudspeaker-dropbox-list-item");
        $items.click(function(e) {
            e.preventDefault();
            e.stopPropagation();
            var $i = $(this);
            var item = $i.tmplItem().data;
            $i.tooltip('hide');
            that.itemContext.open({
                item: item,
                element: $i,
                container: kloudspeaker.App.getElement(),
                viewport: kloudspeaker.App.getElement()
            });
            return false;
        }).each(function() {
            var $i = $(this);
            var item = $i.tmplItem().data;
            $i.tooltip({
                placement: "bottom",
                html: true,
                title: that._pathFormatter.format(item),
                trigger: "hover"
            });
        });
        if (dnd) {
            dnd.enableDrag($items, {
                onDragStart: function($e, e) {
                    var item = $e.tmplItem().data;
                    return {
                        type: 'filesystemitem',
                        payload: item
                    };
                }
            });
        }
        $("#kloudspeaker-dropbox-list .kloudspeaker-dropbox-list-item > a.item-remove").click(function() {
            kloudspeaker.ui.hideActivePopup();
            var $t = $(this);
            that.onRemoveItem($t.tmplItem().data);
        });
    };

    this._updateButton = function() {
        var $btn = $("#kloudspeaker-dropbox-actions > button");
        if (that.items.length > 0)
            $btn.removeClass("disabled");
        else
            $btn.addClass("disabled");
    };

    views.registerFileViewHandler({
        onActivate: that.onFileViewActivate,
        onDeactivate: that.onFileViewDeactivate
    });

    plugins.register({
        id: "plugin-dropbox",
        itemContextHandler: function(item, ctx, data) {
            return {
                actions: [{
                    id: 'pluginDropbox',
                    'title-key': 'pluginDropboxAddTo',
                    callback: function() {
                        that.onAddItem(item);
                        that.openDropbox(true);
                    }
                }]
            };
        },
        itemCollectionHandler: function(items, ctx) {
            if (ctx && ctx.src == 'dropbox') return false;
            return {
                actions: [{
                    'title-key': 'pluginDropboxAddTo',
                    callback: function() {
                        return that.onAddItem(items);
                    }
                }]
            };
        }
    });
});
