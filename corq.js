/*
 * Corq: a queueing library
 * MIT Licensed
 * http://github.com/atuttle/corq
 */
(function(lib){
	if (typeof define === 'function' && define.amd){
		//requirejs, define as a module
		define(lib);
	}else if (typeof module === 'object' && typeof module.exports === 'object'){
		//nodejs module
		module.exports = lib();
	}else{
		window.Corq = lib();
	}
//above this line: define as RequireJS module if RequireJS found; otherwise set into window
//below this line: actual Corq code.
}(function(){



	var corq = function(msFrequency, msDelay, chatty, autostart){
		
		// private variables
		this._queue = []; //the queue
		this._persist = null;
		this._load = null;
		this._callbacks = {};
		this._consecutiveFails = 0;

		// member variables

		
		this.debug = chatty || false;
		this.version = '0.1.18';

		this.running = false;
		this.frequency = msFrequency || 1000 * 5; //default to 5sec
		this.delay = false;
		this.delayLength = msDelay || 1000 * 30; //default to 30sec
		this.autostart = autostart || false;

		// private functions
		function $debug(msg){
			if (this.debug){
				console.log(msg);
			}
		}

		function $next(){
			if (this._queue.length){
				$item(this._queue[0]);
			}else{
				this.running = false;
				$debug('Corq: No items to process, shutting down the queue');
			}
		}

		//calls all necessary handlers for this item
		function $item(item){
			var _self = this;
			var typeName = item.type;
			if (!this._callbacks[typeName]){
				throw "Item handler not found for items of type `" + typeName + "`";
			}
			$debug('Corq: Calling handler for item `' + typeName + '`');
			$debug(item.data);
			var _next = function(){
					var freq = (_self.delay) ? _self.delayLength : _self.frequency;
					setTimeout(function(){
						$next();
				}, freq);
			};
			var _success = function(){
				$debug('Corq: Item processing SUCCESS `' + typeName + '` ');
				$debug(item.data);
				$success(item);
				_next();
			};
			var _fail = function(){
				$debug('Corq: Item processing FAILURE `' + typeName + '` ');
				$debug(item.data);
				$fail(item);
				_next();
			};
			try {
				this._callbacks[typeName](item.data, _success, _fail);
			}catch(e){
				$debug('Corq: Error thrown by item processing function `' + typeName + '` ');
				$debug(item.data);
				_fail();
				throw e;
			}
		}

		function $success(item){
			this.delay = false;
			this._consecutiveFails = 0;
			$delete(item.id);
		}

		function $fail(item){
			this._consecutiveFails++;
			$requeue(item);
			if (this._consecutiveFails >= this._queue.length){
				$debug('Corq: Queue is all failures, initiating cooldown (' + that.delayLength + 'ms)');
				this.delay = true;
			}
		}

		function $requeue(item){
			this._queue.push($clone(item));
			$delete(item.id);
		}

		function $delete(itemId){
			for (var i = 0; i < this._queue.length; i++){
				if (this._queue[i].id === itemId) {
					$debug('Corq: Item deleted from queue `' + this._queue[i].type + '` ');
					$debug(this._queue[i].data);
					this._queue.splice(i,1);
					if (this._persist){ this._persist(this._queue); }
					break;
				}
			}
		}




		this.persistVia = function(persistCallback){
			this._persist = persistCallback;
			return this;
		};

		this.loadVia = function(loadCallback){
			var _self = this;
			$debug('Corq: Loading data...');
			loadCallback(function(data){
				this._queue = data;
				$debug('Corq: Data loaded');
				$debug(this._queue);
				if(_self.autostart){
					_self.start();
				}
			});
			return this;
		};

		//add an item to the queue
		this.push = function(type, item){
			var _self = this;
			this._queue.push( { data:item, type:type, id:$guid() } );
			if (this._persist){ this._persist(this._queue); }
			$debug('Corq: Item added to queue `' + type + '`');
			$debug(item);
			if (!this.running){
				setTimeout(function(){
					_self.running = true;
					$next();
				}, 2000); // delay of 2 secs before pushing
			}
			return this;
		};

		//register item handlers
		this.on = function(typeName, callback){
			if (this._callbacks[typeName]){
				throw "You may only have one handler per item type. You already have one for `" + typeName + "`";
			}
			this._callbacks[typeName] = callback;
			$debug('Corq: Handler registered for `' + typeName + '`');
			return this;
		};

		this.start = function(){		
			$debug('Corq: Queue started');		
			this.running = true;		
			$next();		
			return this;		
		};

		//stop the queue
		this.stop = function(){
			this.running = false;
			$debug('Corq: Queue stopped');
			return this;
		};




		$debug('Corq initialized. Freq: ' + this.frequency + 'ms, Cooldown: ' + this.delayLength + 'ms');

		return this;
	};


	//start the queue		

	function $guid(){
		// http://stackoverflow.com/a/2117523/751
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	}

	function $clone(obj) {
		// http://stackoverflow.com/a/728694/751
		// Handle the 3 simple types, and null or undefined
		if (null == obj || "object" != typeof obj) return obj;

		// Handle Date
		if (obj instanceof Date) {
			var copy = new Date();
			copy.setTime(obj.getTime());
			return copy;
		}

		// Handle Array
		if (obj instanceof Array) {
			var copy = [];
			for (var i = 0, len = obj.length; i < len; i++) {
				copy[i] = $clone(obj[i]);
			}
			return copy;
		}

		// Handle Object
		if (obj instanceof Object) {
			var copy = {};
			for (var attr in obj) {
				if (obj.hasOwnProperty(attr)) copy[attr] = $clone(obj[attr]);
			}
			return copy;
		}

		throw new Error("Unable to copy obj! Its type isn't supported.");
	}



	return corq;

}));
