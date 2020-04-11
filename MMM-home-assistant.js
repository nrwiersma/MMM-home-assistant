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
		window: {
			defaultColor: "red", // css format, i.e. color names or color codes
		},
		lights: {
			/* list all light items to be shown (must be of openhab type Switch or Dimmer), examples below. */
			// Light_Kitchen: { left: 50, top: 50 }, // name must match openhab item name (case sensitive!)
		},
		windows: {
			/* list all window / door contacts to be shown (must be of openhab type Switch or Contact), examples below. */
			/* name must match openhab item name (case sensitive!) */
			/* Supported formats are rectangles, single wings, and wings with counterwindow. */
			// Reed_Front_Door: { left: 100, top: 20, width: 26, height: 35 }, // rectengular drawing
			// Reed_Back_Door: { left: 100, top: 50, width: 26, height: 35, color: "orange", }, // color may optionally be overwritten
			// Reed_Kitchen_Window: { left: 100, top: 100, radius: 30, midPoint: "top-left" }, // wing with specified radius and mid-point location
			// Reed_Livingroom_Window: { left: 100, top: 150, radius: 25, midPoint: "top-left", counterwindow: "horizontal" }, // wing with counterwindow
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
            self.updateDivForItem(state.entity_id, state.state);
        };

		// this.sendNotification("GET_HASS_STATE", this.config.homeAssistant);

		// schedule periodic refresh if configured
		if (!isNaN(this.config.updateInterval) && this.config.updateInterval > 0) {
               setInterval(function() {
                   // self.sendNotification("GET_HASS_STATE", this.config.homeAssistant);
               }, this.config.updateInterval);
		}
	},

    getDom: function() {
		var floorplan = document.createElement("div");
		floorplan.style.cssText = "background-image:url(" + this.file("/images/" + this.config.floorplan.image) + ");"
			+ "top:-" + this.config.floorplan.height + "px;width:" + this.config.floorplan.width + "px;height:" + this.config.floorplan.height + "px;";

		this.appendWindows(floorplan);
		this.appendLights(floorplan);

        return floorplan;
	},

	updateDivForItem: function(item, state) {
        var visible = state == "on";
		this.setVisible("hass_" + item, visible);
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
		// set style: location
		var style = "margin-left:" + position.left + "px;margin-top:" + position.top + "px;position:absolute;"
			+ "height:" + this.config.light.height + "px;width:" + this.config.light.width + "px;";
		if (!this.config.draft)
			style += "display:none;"; // hide by default, do not hide if all items should be shown

		// create div, set style and text
		var lightDiv = document.createElement("div");
		lightDiv.id = 'hass_' + item;
		lightDiv.style.cssText = style;
		lightDiv.innerHTML = "<img src='" + this.file("/images/" + this.config.light.image) + "' style='"
			+ "height:" + this.config.light.height + "px;width:" + this.config.light.width + "px;'/>";
		return lightDiv;
	},

	appendWindows: function(floorplan) {
		for (var item in this.config.windows) {
			// get config for this window, create div, and append it to the floorplan
			var windowConfig = this.config.windows[item];
			floorplan.appendChild(this.getWindowDiv(item, windowConfig));

			// if 'counterwindow' is set, we must append another one according to given direction
			if (windowConfig.counterwindow !== 'undefined' && windowConfig.radius !== 'undefined') {
				// clone given window config for other wing of counterwindow: http://stackoverflow.com/questions/728360/how-do-i-correctly-clone-a-javascript-object
				var counterwindowConfig = JSON.parse(JSON.stringify(windowConfig));
				if (windowConfig.counterwindow == 'horizontal') {
					counterwindowConfig.left += windowConfig.radius
					counterwindowConfig.midPoint = this.getMirroredMidPoint(windowConfig.midPoint, true);
					floorplan.appendChild(this.getWindowDiv(item + "_counterwindow", counterwindowConfig));
				} else if (windowConfig.counterwindow == 'vertical') {
					counterwindowConfig.top += windowConfig.radius
					counterwindowConfig.midPoint = this.getMirroredMidPoint(windowConfig.midPoint, false);
					floorplan.appendChild(this.getWindowDiv(item + "_counterwindow", counterwindowConfig));
				}
			}
		}
	},
	getMirroredMidPoint: function(midPoint, horizontal) {
		if (horizontal  && midPoint.endsWith  ("left"))   return midPoint.slice(0, midPoint.indexOf('-')) + "-right";
		if (horizontal  && midPoint.endsWith  ("right"))  return midPoint.slice(0, midPoint.indexOf('-')) + "-left";
		if (!horizontal && midPoint.startsWith("top"))    return "bottom" + midPoint.slice(midPoint.indexOf('-'));
		if (!horizontal && midPoint.startsWith("bottom")) return "top"    + midPoint.slice(midPoint.indexOf('-'));
	},
	getWindowDiv: function(item, windowConfig) {
		// default color, but may be overridden for each window
		var color = this.getSpecificOrDefault(windowConfig.color, this.config.window.defaultColor);

		// prepare style with location and hide it!
		var style = "margin-left:" + windowConfig.left + "px;margin-top:" + windowConfig.top + "px;position:absolute;";
		if (!this.config.draft)
			style += "display:none;"; // hide by default, do not hide if all items should be shown

		// if radius is set, it's a wing with a radius
		if (typeof windowConfig.radius !== 'undefined') {
			var radius = windowConfig.radius;
			style += this.getRadiusStyle(radius, windowConfig.midPoint) + "height:" + radius + "px;width:" + radius + "px;";
		} else {
			// otherwise it's a rectengular window with width and height
			style += "height:" + windowConfig.height + "px;width:" + windowConfig.width + "px;";
		}

		// create div representing the window
		var windowDiv = document.createElement("div");
		windowDiv.id = 'hass_' + item;
		windowDiv.style.cssText = "background:" + color + ";" + style; // set color, location, and type-specific style
		return windowDiv
	},
	getRadiusStyle: function(radius, midPoint) {
		// example from: http://1stwebmagazine.com/css-quarter-circle
		var radiusBounds = "0 0 " + radius + "px 0;"; // default: top-left
		if (midPoint == "top-right") {
			radiusBounds = "0 0 0 " + radius + "px;";
		} else if (midPoint == "bottom-left") {
			radiusBounds = "0 " + radius + "px 0 0;";
		} else if (midPoint == "bottom-right") {
			radiusBounds = radius + "px 0 0 0;";
		}
		return "border-radius: " + radiusBounds + " -moz-border-radius: " + radiusBounds + " -webkit-border-radius: " + radiusBounds;
	},
	getSpecificOrDefault: function(specificValue, defaultValue) {
		if (typeof specificValue !== 'undefined')
			return specificValue; // specific value is defined, so use that one!
		return defaultValue; // no specific value defined, use default value
	},
});
