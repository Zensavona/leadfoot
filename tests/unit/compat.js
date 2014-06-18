define([
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!dojo/Promise',
	'intern/dojo/node!../../Session',
	'intern/dojo/node!../../Command',
	'intern/dojo/node!../../compat',
	'intern/dojo/node!dojo/topic'
], function (registerSuite, assert, Promise, Session, Command, compat, topic) {
	function assertWarn() {
		assert.isNotNull(lastNotice);
		for (var i = 0, j = arguments.length; i < j; ++i) {
			arguments[i] && assert.include(lastNotice[i], arguments[i]);
		}
	}

	function mockCommand(object, method, testName, test) {
		var originalMethod;
		var suite = {
			setup: function () {
				originalMethod = object[method];
				object[method] = function () {
					var args = Array.prototype.slice.call(arguments, 0);
					return new Command(this, function () {
						if (args[0] instanceof Error) {
							return Promise.reject(args[0]);
						}

						return Promise.resolve(args);
					});
				};
			},
			teardown: function () {
				object[method] = originalMethod;
			}
		};

		suite[testName] = test;
		return suite;
	}

	function deprecate(method, replacement) {
		return mockCommand(command, replacement, 'deprecate', function () {
			return command[method]('a', 'b').then(function (value) {
				assert.deepEqual(value, [ 'a', 'b' ], 'Replacement method should be invoked with same arguments');
				assertWarn('Command#' + method, 'Command#' + replacement);
			});
		});
	}

	function deprecateElementSig(fromMethod, toMethod, standardSigAlsoDeprecated) {
		return mockCommand(Command.prototype, fromMethod, 'deprecateElementSig', function () {
			function testElementSig() {
				return command[fromMethod](element, 'c', 'd').then(function (value) {
					assert.deepEqual(value, [ 'c', 'd' ]);
					assertWarn('Command#' + fromMethod + '(element)', 'Command#find then Command#' + fromMethod);
					assertWarn('Command#' + fromMethod + '(element)', 'element.' + (toMethod || fromMethod));
				});
			}

			var element = {
				elementId: 'test'
			};
			element[toMethod || fromMethod] = function () {
				return Promise.resolve(Array.prototype.slice.call(arguments, 0));
			};

			if (standardSigAlsoDeprecated) {
				return testElementSig();
			}

			return command[fromMethod]('a', 'b').then(function (value) {
				assert.deepEqual(value, [ 'a', 'b' ], 'Unmodified method should be invoked with same arguments');
				assert.isNull(lastNotice);
				return testElementSig();
			});
		});
	}

	function deprecateElementAndStandardSig(method, replacement) {
		return {
			'element signature': deprecateElementSig(method, replacement, true),
			'standard signature': deprecate(method, replacement)
		};
	}

	var capabilities = {};
	var command = new Command(new Session('test', {
		getStatus: function () {
			return Promise.resolve('hapy');
		},
		getSessions: function () {
			return Promise.resolve('many things');
		},
		_get: function () {
			return Promise.resolve(arguments);
		},
		_post: function () {
			return Promise.resolve(arguments);
		},
		_delete: function () {
			return Promise.resolve(arguments);
		}
	}, capabilities));

	compat.applyTo(command);

	var handle = topic.subscribe('/deprecated', function () {
		lastNotice = arguments;
	});

	var lastNotice;

/*
strategies.suffixes.forEach(function (suffix, index) {
	function addStrategy(method, toMethod, suffix, wdSuffix, using) {
		methods[method + 'OrNull'] = function (value) {
			warn('Command#' + method + 'OrNull', 'Command#' + toMethod +
				' and Command#always, or Command#elementsBy' + suffix);
			return elementOrNull.call(this, using, value);
		};

		methods[method + 'IfExists'] = function (value) {
			warn('Command#' + method + 'IfExists', 'Command#' + toMethod +
				' and Command#always, or Command#elementsBy' + suffix);
			return elementIfExists.call(this, using, value);
		};

		methods['hasElementBy' + wdSuffix] = function (value) {
			warn('Command#hasElementBy' + wdSuffix, 'Command#' + toMethod +
				' and Command#then(exists, doesNotExist)');
			return hasElement.call(this, using, value);
		};

		method['waitForElement' + wdSuffix] = function (value, timeout) {
			warn(
				'Command#waitForElement' + wdSuffix,
				'Command#setImplicitWaitTimeout and Command#' + toMethod,
				'This command is implemented using implicit timeouts, which may not match the prior behaviour.'
			);
			return waitForElement.call(this, using, value, timeout);
		};

		method['waitForVisible' + wdSuffix] = function (value, timeout) {
			warn(
				'Command#waitForVisible' + wdSuffix,
				null,
				'This command is partially implemented using implicit timeouts, which may not match the prior ' +
				'behaviour.'
			);
			return waitForVisible.call(this, using, value, timeout);
		};
	}

	var wdSuffix = suffix === 'XPath' ? 'XPath' : suffix;
	var method = 'elementBy' + wdSuffix;
	var toMethod = 'findBy' + suffix;
	var using = strategies[index];
	addStrategy(method, toMethod, suffix, wdSuffix, using);
	if (suffix === 'CssSelector') {
		addStrategy('elementByCss', toMethod, suffix, 'Css', using);
	}
});
*/

	registerSuite({
		name: 'leadfoot/compat',

		beforeEach: function () {
			lastNotice = null;
		},

		teardown: function () {
			handle.remove();
			lastNotice = command = handle = null;
		},

		'assertion sanity check': function () {
			assert.throws(function () {
				assertWarn('a');
			});
		},

		'mockCommand sanity check': mockCommand(command, 'test', 'sanity check', function () {
			return command.test('a', 'b').then(function (args) {
				assert.deepEqual(args, [ 'a', 'b' ]);
				return command.test(new Error('Should reject'));
			}).then(function () {
				throw new Error('Should have rejected');
			}, function (error) {
				assert.strictEqual(error.message, 'Should reject');
			});
		}),

		'#sessionID': function () {
			assert.strictEqual(command.sessionID, command.session.sessionId);
			assertWarn('Command#sessionID', 'Command#session.sessionId');
		},

		'#status': function () {
			return command.status().then(function (value) {
				assert.strictEqual(value, 'hapy');
				assertWarn('Command#status');
			});
		},

		'#init': function () {
			assert.strictEqual(command.init(), command);
			assertWarn('Command#init');
		},

		'#sessions': function () {
			return command.sessions().then(function (value) {
				assert.strictEqual(value, 'many things');
				assertWarn('Command#sessions');
			});
		},

		'#sessionCapabilities': function () {
			return command.sessionCapabilities().then(function (capabilities) {
				assert.strictEqual(capabilities, command.session.capabilities);
				assertWarn('Command#sessionCapabilities', 'Command#session.capabilities');
			});
		},

		'#altSessionCapabilities': function () {
			return command.altSessionCapabilities().then(function (capabilities) {
				assert.strictEqual(capabilities, command.session.capabilities);
				assertWarn('Command#altSessionCapabilities', 'Command#session.capabilities');
			});
		},

		'#getSessionId': function () {
			return command.getSessionId().then(function (sessionId) {
				assert.strictEqual(sessionId, command.session.sessionId);
				assertWarn('Command#getSessionId', 'Command#session.sessionId');
			});
		},

		'#getSessionID': function () {
			return command.getSessionID().then(function (sessionId) {
				assert.strictEqual(sessionId, command.session.sessionId);
				assertWarn('Command#getSessionID', 'Command#session.sessionId');
			});
		},

		'#setAsyncScriptTimeout': deprecate('setAsyncScriptTimeout', 'setExecuteAsyncTimeout'),
		'#setWaitTimeout': deprecate('setWaitTimeout', 'setFindTimeout'),
		'#setImplicitWaitTimeout': deprecate('setImplicitWaitTimeout', 'setFindTimeout'),
		'#windowHandle': deprecate('windowHandle', 'getCurrentWindowHandle'),
		'#windowHandles': deprecate('windowHandles', 'getAllWindowHandles'),
		'#url': deprecate('url', 'getCurrentUrl'),
		'#forward': deprecate('forward', 'goForward'),
		'#back': deprecate('back', 'goBack'),
		'#safeExecute': deprecate('safeExecute', 'execute'),
		'#eval': mockCommand(command, 'execute', 'eval', function () {
			/* jshint evil:true */
			return command.eval('test').then(function (args) {
				assert.strictEqual(args[0], 'return eval(arguments[0]);');
				assert.deepEqual(args[1], [ 'test' ]);
				assertWarn('Command#eval', 'Command#execute');
			});
		}),
		'#safeEval': mockCommand(command, 'execute', 'eval', function () {
			return command.safeEval('test').then(function (args) {
				assert.strictEqual(args[0], 'return eval(arguments[0]);');
				assert.deepEqual(args[1], [ 'test' ]);
				assertWarn('Command#safeEval', 'Command#execute');
			});
		}),
		'#safeExecuteAsync': deprecate('safeExecuteAsync', 'executeAsync'),
		'#frame': deprecate('frame', 'switchToFrame'),
		'#window': deprecate('window', 'switchToWindow'),
		'#close': deprecate('close', 'closeCurrentWindow'),
		'#windowSize': deprecate('windowSize', 'setWindowSize'),
		'#setWindowSize': mockCommand(Command.prototype, 'setWindowSize', 'setWindowSize', function () {
			return command.setWindowSize(1, 2).then(function (args) {
				assert.deepEqual(args, [ 1, 2 ]);
				assert.isNull(lastNotice);
				return command.setWindowSize('foo', 2, 3);
			}).then(function (args) {
				assert.deepEqual(args, [ 'foo', 2, 3 ]);
				assert.isNull(lastNotice);
				return command.setWindowSize(3, 4, 'bar');
			}).then(function (args) {
				assert.deepEqual(args, [ 'bar', 3, 4 ]);
				assertWarn('Command#setWindowSize(width, height, handle)', 'Command#setWindowSize(handle, width, height)');
			});
		}),
		'#setWindowPosition': mockCommand(Command.prototype, 'setWindowPosition', 'setWindowPosition', function () {
			return command.setWindowPosition(1, 2).then(function (args) {
				assert.deepEqual(args, [ 1, 2 ]);
				assert.isNull(lastNotice);
				return command.setWindowPosition('foo', 2, 3);
			}).then(function (args) {
				assert.deepEqual(args, [ 'foo', 2, 3 ]);
				assert.isNull(lastNotice);
				return command.setWindowPosition(3, 4, 'bar');
			}).then(function (args) {
				assert.deepEqual(args, [ 'bar', 3, 4 ]);
				assertWarn('Command#setWindowPosition(x, y, handle)', 'Command#setWindowPosition(handle, x, y)');
			});
		}),
		'#maximize': deprecate('maximize', 'maximizeWindow'),
		'#allCookies': deprecate('allCookies', 'getCookies'),
		'#deleteAllCookies': deprecate('deleteAllCookies', 'clearCookies'),
		'#source': deprecate('source', 'getPageSource'),
		'#title': deprecate('title', 'getPageTitle'),
		'#element': deprecate('element', 'find'),
		'#elementByClassName': deprecate('elementByClassName', 'findByClassName'),
		'#elementByCssSelector': deprecate('elementByCssSelector', 'findByCssSelector'),
		'#elementById': deprecate('elementById', 'findById'),
		'#elementByName': deprecate('elementByName', 'findByName'),
		'#elementByLinkText': deprecate('elementByLinkText', 'findByLinkText'),
		'#elementByPartialLinkText': deprecate('elementByPartialLinkText', 'findByPartialLinkText'),
		'#elementByTagName': deprecate('elementByTagName', 'findByTagName'),
		'#elementByXPath': deprecate('elementByXPath', 'findByXpath'),
		'#elementByCss': deprecate('elementByCss', 'findByCssSelector'),
		'#elements': deprecate('elements', 'findAll'),
		'#elementsByClassName': deprecate('elementsByClassName', 'findAllByClassName'),
		'#elementsByCssSelector': deprecate('elementsByCssSelector', 'findAllByCssSelector'),
		'#elementsById': mockCommand(command, 'findAll', 'elementsById', function () {
			return command.elementsById('a').then(function (args) {
				assert.deepEqual(args, [ 'id', 'a' ]);
				assertWarn('Command#elementsById', 'Command#findById');
			});
		}),
		'#elementsByName': deprecate('elementsByName', 'findAllByName'),
		'#elementsByLinkText': deprecate('elementsByLinkText', 'findAllByLinkText'),
		'#elementsByPartialLinkText': deprecate('elementsByPartialLinkText', 'findAllByPartialLinkText'),
		'#elementsByTagName': deprecate('elementsByTagName', 'findAllByTagName'),
		'#elementsByXPath': deprecate('elementsByXPath', 'findAllByXpath'),
		'#elementsByCss': deprecate('elementsByCss', 'findAllByCssSelector'),
		'#elementOrNull': mockCommand(command, 'find', 'elementOrNull', function () {
			return command.elementOrNull('a', 'b').then(function (args) {
				assert.deepEqual(args, [ 'a', 'b' ]);
				return command.elementOrNull(new Error('Should resolve to null, not reject'));
			}).then(function (result) {
				assert.isNull(result);
			});
		}),
		'#elementIfExists': mockCommand(command, 'find', 'elementIfExists', function () {
			return command.elementIfExists('a', 'b').then(function (args) {
				assert.deepEqual(args, [ 'a', 'b' ]);
				return command.elementIfExists(new Error('Should resolve to undefined, not reject'));
			}).then(function (result) {
				assert.isUndefined(result);
			});
		}),
		'#hasElement': mockCommand(command, 'find', 'hasElement', function () {
			return command.hasElement('a', 'b').then(function (hasElement) {
				assert.isTrue(hasElement);
				assertWarn('Command#hasElement', 'Command#find');
				return command.hasElement(new Error('Should resolve to false, not reject'));
			}).then(function (hasElement) {
				assert.isFalse(hasElement);
			});
		}),
		'#active': deprecate('active', 'getActiveElement'),
		'#clickElement': deprecateElementSig('clickElement', 'click'),
		'#submit': deprecateElementSig('submit'),
		'#text': deprecateElementAndStandardSig('text', 'getVisibleText'),

		'#textPresent': (function () {
			var originalMethod;
			return {
				setup: function () {
					originalMethod = command.getVisibleText;
					command.getVisibleText = function () {
						return new Command(this, function () {
							return Promise.resolve('foo');
						});
					};
				},
				teardown: function () {
					command.getVisibleText = originalMethod;
				},
				'pass-through': function () {
					return command.textPresent('foo').then(function (result) {
						assert.isTrue(result);
						assertWarn('Command#textPresent', 'Command#getVisibleText');
						return command.textPresent('bar');
					}).then(function (result) {
						assert.isFalse(result);
					});
				},
				'with element': function () {
					var element = {
						getVisibleText: function () {
							return Promise.resolve('baz');
						}
					};

					return command.textPresent('foo', element).then(function (result) {
						assert.isFalse(result);
						return command.textPresent('baz', element);
					}).then(function (result) {
						assert.isTrue(result);
					});
				}
			};
		})(),

		// This is not backwards-compatible because it is impossible to know whether someone is expecting this to
		// work like the old element `type` because they have not converted their code yet, or like the new session
		// `type` because they have
		'#type': deprecateElementSig('type', 'type'),

		'#keys': deprecate('keys', 'type'),
		'#getTagName': deprecateElementSig('getTagName'),
		'#clear': deprecateElementAndStandardSig('clear', 'clearValue'),
		'#isSelected': deprecateElementSig('isSelected'),
		'#isEnabled': deprecateElementSig('isEnabled'),
		'#enabled': deprecateElementAndStandardSig('enabled', 'isEnabled'),
		'#getAttribute': deprecateElementSig('getAttribute'),
		'#getValue': mockCommand(command, 'getAttribute', 'deprecate', function () {
			return command.getValue().then(function (args) {
				assert.deepEqual(args, [ 'value' ]);
				assertWarn('Command#getValue', 'Command#getAttribute(\'value\')');

				var element = {
					elementId: 'test',
					getAttribute: function () {
						return Promise.resolve(Array.prototype.slice.call(arguments, 0).concat('fromElement'));
					}
				};

				return command.getValue(element).then(function (args) {
					assert.deepEqual(args, [ 'value', 'fromElement' ]);
					assertWarn('Command#getValue(element)', 'Command#getAttribute(\'value\')');
				});
			});
		}),
		'#equalsElement': mockCommand(command, 'equals', 'deprecate', function () {
			var otherElement = {
				elementId: 'other'
			};

			return command.equalsElement(otherElement).then(function (args) {
				assert.deepEqual(args, [ otherElement ]);
				assertWarn('Command#equalsElement', 'Command#equals');

				var element = {
					elementId: 'test',
					equals: function (other) {
						return Promise.resolve([ other, 'fromElement' ]);
					}
				};

				return command.equalsElement(element, otherElement).then(function (args) {
					assert.deepEqual(args, [ otherElement, 'fromElement' ]);
					assertWarn('Command#equalsElement', 'element.equals(other)');
				});
			});
		}),
		'#isDisplayed': deprecateElementSig('isDisplayed'),
		'#displayed': deprecateElementAndStandardSig('displayed', 'isDisplayed'),
		'#getLocation': deprecateElementAndStandardSig('getLocation', 'getPosition'),
		'#getLocationInView': mockCommand(command, 'getPosition', 'deprecate', function () {
			return command.getLocationInView('a', 'b').then(function (args) {
				assert.deepEqual(args, [ 'a', 'b' ]);
				assertWarn('Command#getLocationInView', 'Command#getPosition');
			});
		}),
		'#getSize': deprecateElementSig('getSize'),
		'#getComputedCss': deprecateElementAndStandardSig('getComputedCss', 'getComputedStyle'),
		'#getComputedCSS': deprecateElementAndStandardSig('getComputedCSS', 'getComputedStyle'),
		'#alertText': deprecate('alertText', 'getAlertText'),
		'#alertKeys': deprecate('alertKeys', 'typeInPrompt'),
		'#moveTo': deprecateElementAndStandardSig('moveTo', 'moveMouseTo'),
		'#click': deprecateElementSig('click'),
		'#buttonDown': deprecate('buttonDown', 'pressMouseButton'),
		'#buttonUp': deprecate('buttonUp', 'releaseMouseButton'),
		'#doubleclick': deprecate('doubleclick', 'doubleClick'),
		'#tapElement': deprecateElementSig('tapElement', 'tap'),
		'#flick': deprecate('flick', 'flickFinger'),
		'#setLocalStorageKey': deprecate('setLocalStorageKey', 'setLocalStorageItem'),
		'#getLocalStorageKey': deprecate('getLocalStorageKey', 'getLocalStorageItem'),
		'#removeLocalStorageKey': deprecate('removeLocalStorageKey', 'deleteLocalStorageItem'),
		'#log': deprecate('log', 'getLogsFor'),
		'#logTypes': deprecate('logTypes', 'getAvailableLogTypes'),
		'#newWindow': mockCommand(command, 'execute', 'deprecate', function () {
			return command.newWindow('a', 'b').then(function (args) {
				assert.deepEqual(args, [ 'window.open(arguments[0], arguments[1]);', [ 'a', 'b' ] ]);
				assertWarn('Command#newWindow', 'Command#execute');
			});
		}),
		'#windowName': mockCommand(command, 'execute', 'deprecate', function () {
			return command.windowName().then(function (args) {
				assert.deepEqual(args, [ 'return window.name;' ]);
				assertWarn('Command#windowName', 'Command#execute');
			});
		}),
		'#setHTTPInactivityTimeout': function () {
			var inactivityCommand = command.setHTTPInactivityTimeout();
			return inactivityCommand.then(function () {
				assert.strictEqual(inactivityCommand, command);
				assertWarn('Command#setHTTPInactivityTimeout');
			});
		},
		'#getPageIndex': function () {
			throw new Error('TODO');
		},
		'#uploadFile': function () {
			var uploadCommand = command.uploadFile();
			return uploadCommand.then(function () {
				assert.strictEqual(uploadCommand, command);
				assertWarn('Command#uploadFile', 'Command#type');
			});
		},
		'#waitForCondition': function () {
			throw new Error('TODO');
		},
		'#waitForConditionInBrowser': function () {
			throw new Error('TODO');
		},
		'#sauceJobUpdate': function () {
			var updateCommand = command.sauceJobUpdate();
			return updateCommand.then(function () {
				assert.strictEqual(updateCommand, command);
				assertWarn('Command#sauceJobUpdate');
			});
		},
		'#sauceJobStatus': function () {
			var updateCommand = command.sauceJobStatus();
			return updateCommand.then(function () {
				assert.strictEqual(updateCommand, command);
				assertWarn('Command#sauceJobStatus');
			});
		},
		'#waitForElement': function () {
			throw new Error('TODO');
		},
		'#waitForVisible': function () {
			throw new Error('TODO');
		},
		'#isVisible': function () {
			throw new Error('TODO');
		}
	});
});
