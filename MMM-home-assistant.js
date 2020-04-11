Module.register("MMM-home-assistant", {
    defaults: {
		updateInterval: 60 * 60 * 1000,
        draft: false,
        homeAssistant: {
            addr: "hass:8123",
            token: "SomeLongLivedTOken"
        },
		floorplan: {
			/* store your image as 'floorplan.png' to avoid git repository changes. */
			image: "floorplan-default.png", // located in subfolder 'images'
			width: 400, // image width
			height: 333, // image height
		},
		light: {
			image: "light.png", // located in subfolder 'images'
			width: 19, // image width
			height: 19, // image height
		},
		portal: {
			color: "red", // css format, i.e. color names or color codes
		},
		lights: {
			/* list all light items to be shown. */
			// light.kitchen: { left: 50, top: 50 },
		},
		portals: {
			/* list all window / door contacts to be shown. */
			/* name must match openhab item name (case sensitive!) */
			// door.front: { left: 100, top: 20, width: 26, height: 35 },
			// door.back: { left: 100, top: 50, width: 26, height: 35, color: "orange" } // color may optionally be overwritten
		},
    },

    // Define required scripts.
	getScripts: function() {
		return ["https://unpkg.com/event-source-polyfill@1.0.12/src/eventsource.js"];
	},

	start: function() {
		Log.info("Starting module: " + this.name);

        var self = this;
		if (this.config.draft) {
			Log.info("home assistant items are not loaded because module is in draft mode");
            return;
		}

        var EventSource = EventSourcePolyfill;
        var source = new EventSource("http://" + this.config.homeAssistant.addr + "/api/stream", {
    		headers: {
                Authorization: "Bearer " + this.config.homeAssistant.token,
                "Content-Type": "application/json"
            },
            withCredentials: false
        });
        source.onmessage = function(event) {
            if (event.data == "ping") {
                return;
            }

            var obj = JSON.parse(event.data);
            if (obj.event_type != "state_changed") {
                return
            }

            var state = obj.data.new_state;
            self.updateState(state.entity_id, state.state);
        };

		if (!isNaN(this.config.updateInterval) && this.config.updateInterval > 0) {
            setInterval(function() {
                self.updateAllStates();
            }, this.config.updateInterval);
		}
	},

    getDom: function() {
		var floorplan = document.createElement("div");
		floorplan.style.cssText = "background-image:url(" + this.file("/images/" + this.config.floorplan.image) + ");"
			+ "top:-" + this.config.floorplan.height + "px;width:" + this.config.floorplan.width + "px;height:" + this.config.floorplan.height + "px;";

		this.appendPortals(floorplan);
		this.appendLights(floorplan);

        if (!this.config.draft) {
            this.updateAllStates();
        }

        return floorplan;
	},

    updateAllStates: function() {
        var self = this;

        var url = "http://" + this.config.homeAssistant.addr + "/api/states";
		var req = new XMLHttpRequest();
		req.open("GET", url, true);
        req.setRequestHeader("Authorization", "Bearer " + this.config.homeAssistant.token)
		req.onreadystatechange = function() {
			if (this.readyState === 4) {
				if (this.status === 200) {
					objs = JSON.parse(this.response);
                    for (const obj of objs) {
                      self.updateState(obj.entity_id, obj.state);
                    }
				} else {
					Log.error(self.name + ": Could not load states.");
				}
			}
		};
		req.send();
    },
	updateState: function(item, state) {
        if (item in this.config.lights) {
            var visible = state == "on";
    		this.setVisible("hass." + item, visible);
        } else if (item in this.config.portals) {
            var visible = state == "on";
    		this.setVisible("hass." + item, visible);
        }
	},
	setVisible: function(id, value) {
		var element = document.getElementById(id);
		if (element != null) {
			element.style.display = value ? "block" : "none";
		}
	},

	appendLights: function(floorplan) {
		for (var item in this.config.lights) {
			var position = this.config.lights[item];
			floorplan.appendChild(this.getLightDiv(item, position));
		}
	},
	getLightDiv: function(item, position) {
		var style = "margin-left:" + position.left + "px;margin-top:" + position.top + "px;position:absolute;"
			+ "height:" + this.config.light.height + "px;width:" + this.config.light.width + "px;";
		if (!this.config.draft) {
			style += "display:none;";
        }

		var div = document.createElement("div");
		div.id = 'hass.' + item;
		div.style.cssText = style;
		div.innerHTML = "<img src='" + this.file("/images/" + this.config.light.image) + "' style='"
			+ "height:" + this.config.light.height + "px;width:" + this.config.light.width + "px;'/>";
		return div;
	},

	appendPortals: function(floorplan) {
		for (var item in this.config.portals) {
			var config = this.config.portals[item];
			floorplan.appendChild(this.getPortalDiv(item, config));
		}
	},
	getPortalDiv: function(item, config) {
		var color = config.color;
        if (config.color !== "undefined") {
            color = this.config.portal.color;
        }

		var style = "margin-left:" + config.left + "px;margin-top:" + config.top + "px;position:absolute;";
		if (!this.config.draft) {
			style += "display:none;";
        }
		style += "height:" + config.height + "px;width:" + config.width + "px;";

		// create div representing the window
		var div = document.createElement("div");
		div.id = 'hass.' + item;
		div.style.cssText = "background:" + color + ";" + style; // set color, location, and type-specific style
		return div
	},
});
