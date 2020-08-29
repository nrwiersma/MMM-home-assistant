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
			image: "floorplan-default.svg", // located in subfolder 'images'
			width: 400, // image width
			height: 333, // image height
		},
		light: {
            color: "#ffd400", // css format, i.e. color names or color codes
            stroke: "#ffd400", // css format, i.e. color names or color codes
		},
		door: {
			color: "#42a2dd", // css format, i.e. color names or color codes
            stroke: "#42a2dd", // css format, i.e. color names or color codes
		},
		lights: {
			/* list all lights element ids. */
			// "light.kitchen": "svg-light-id",
		},
		doors: {
			/* list all door elements in the svg. */
			// "door.front": "svg-door-id",
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
		floorplan.style.cssText = ""//"background-image:url(" + this.file("/images/" + this.config.floorplan.image) + ");"
			+ "top:-" + this.config.floorplan.height + "px;width:" + this.config.floorplan.width + "px;height:" + this.config.floorplan.height + "px;";

        var obj = document.createElement("embed");
        obj.id = "floorplan";
        obj.type = "image/svg+xml";
        obj.src = this.file("/images/" + this.config.floorplan.image);
        floorplan.appendChild(obj);

        if (!this.config.draft) {
            this.updateAllStates();
        } else {
            var self = this;
            setTimeout(function(){
                for (l in self.config.lights) {
                    self.updateState(l, "on");
                }
                for (d in self.config.doors) {
                    self.updateState(d, "on");
                }
            }, 1000);
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
        var visible = state == "on";
        var id;
        var config;

        id = this.getLight(item);
        if (id) {
            config = this.config.light;
        } else {
            id = this.getDoor(item);
            config = this.config.door;
        }
    	this.setVisible(id, config, visible);
	},
    getLight: function(item) {
        if (this.config.lights.hasOwnProperty(item)) {
            return this.config.lights[item];
        }
        return null;
    },
    getDoor: function(item) {
        if (this.config.doors.hasOwnProperty(item)) {
            return this.config.doors[item];
        }
        return null;
    },
	setVisible: function(id, config, on) {
        if (!id) {
            return;
        }

        var doc = document.getElementById("floorplan").getSVGDocument();
		var element = doc.getElementById(id);
		if (element == null) {
            return;
        }
        if (!on) {
            element.removeAttribute("style");
            return;
        }
        element.style.fill = config.color;
        element.style.stroke = config.stroke;
	}
});
