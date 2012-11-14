"use strict";

if (typeof (JSIL) === "undefined")
  throw new Error("JSIL.Core is required");

JSIL.RootStack = [{}];
JSIL.RootStackInverse = [new WeakMap()];
JSIL.ObjectNextIndex = 1;

// temporary short-lived root
JSIL.NewObjectRootIndex = -1;
JSIL.NewObjectRoot = null;

JSIL.PushObjectRootStore = function () {
  var newStore = {};
  var newStoreReverse = new WeakMap();

  JSIL.ObjectRootTempStack.push(newStore);
  JSIL.ObjectRootTempStackReverse.push(newStoreReverse);
};

JSIL.PopObjectRootStore = function () {
  // never let this go down below 1
  if (JSIL.ObjectRootTempStack.length == 1) {
    throw "CleanupObjectRoot: mismatched PopObjectRootStore!";
  }

  // we don't actually need to do anything here; we just need to remove the refs
  // and let the gc take care of it
  JSIL.ObjectRootTempStack.pop();
  JSIL.ObjectRootTempStackReverse.pop();
};

JSIL.DumpObjectRootStats = function () {
  var minIndex = 2147483647, maxIndex = 0;
  var permCount = 0, tempCount = 0;
  var i;

  for (i in JSIL.RootStack[0]) {
    permCount++;
    minIndex = Math.min(minIndex, i);
    maxIndex = Math.max(maxIndex, i);
  }

  for (var j = 1; j < JSIL.RootStack.length; ++j) {
    for (i in JSIL.RootStack[j]) {
      tempCount++;
      minIndex = Math.min(minIndex, i);
      maxIndex = Math.max(maxIndex, i);
    }
  }

  // make the output pretty
  if (permCount == 0 && tempCount == 0)
    minIndex = 0;

  JSIL.Host.logWriteLine("Root stats: " + permCount + " permanent, " + tempCount + " temporary -- min: " + minIndex + " max: " + maxIndex);
};

JSIL.AllocateObjectIndex = function () {
  // INT32_MAX
  if (JSIL.ObjectNextIndex == 2147483647) {
    JSIL.DumpObjectRootStats();
    throw "AllocateObjectIndex: too many objects allocated; would overflow INT32_MAX!";
  }

  var nextIndex = JSIL.ObjectNextIndex++;
  return nextIndex;
};

JSIL.FindExistingObjectRoot = function (obj) {
  for (var i = 0; i < JSIL.RootStackInverse.length; ++i) {
    var wm = JSIL.RootStackInverse[i];
    if (wm.has(obj))
      return wm.get(obj);
  }

  return -1;
};

JSIL.InternalRootObject = function (obj, destStoreIndex) {
  if (JSIL.NewObjectRootIndex != -1 && JSIL.NewObjectRoot === obj) {
    // new object is becoming rooted for real somewhere
    var index = JSIL.NewObjectRootIndex;
    JSIL.RootStack[destStoreIndex][index] = obj;
    JSIL.RootStackInverse[destStoreIndex][obj] = index;

    JSIL.NewObjectRootIndex = -1;
    JSIL.NewObjectRoot = null;

    return index;
  }

  var existingRoot = JSIL.FindExistingObjectRoot(obj);
  if (existingRoot != -1)
    return existingRoot;

  var objIndex = JSIL.AllocateObjectIndex();
  JSIL.RootStack[destStoreIndex][objIndex] = obj;
  JSIL.RootStackInverse[destStoreIndex].set(obj, objIndex);

  return objIndex;
};

JSIL.TempRootObject = function (obj) {
  if (obj == null)
    return 0;

  var stackIndex = JSIL.RootStack.length - 1;
  if (stackIndex < 0)
    throw "Must have called PushObjectRootStore at least once to use TempRootObject!";

  return JSIL.InternalRootObject (obj, stackIndex);
};

JSIL.RootObject = function (obj) {
  if (obj == null)
    return 0;

  var objIndex = JSIL.InternalRootObject (obj, 0);
  if (!JSIL.RootStack[0].hasOwnProperty(objIndex)) {
    // it was temprooted elsewhere; root it in 0, too
    JSIL.RootStack[0][objIndex] = obj;
    JSIL.RootStackInverse[0].set(obj, objIndex);
  }
  return objIndex;
};

JSIL.TempRootNewObject = function (obj) {
  if (obj == null)
    return 0;

  JSIL.NewObjectRootIndex = JSIL.ObjectNextIndex++;
  JSIL.NewObjectRoot = obj;

  return JSIL.NewObjectRootIndex;
};

JSIL.ObjectFromMonoObjectPtr = function (objptr) {
  // this makes no attempt to verify the type of the object being returned
  if (objptr == 0)
    return null;

  // it's in the new object root
  if (JSIL.NewObjectRootIndex == objptr) {
    if (JSIL.NewObjectRoot instanceof JSIL.Variable)
      return JSIL.NewObjectRoot.value;
    return JSIL.NewObjectRoot;
  }

  for (var i = 0; i < JSIL.RootStack.length; ++i) {
    var roots = JSIL.RootStack[i];
    if (roots.hasOwnProperty(objptr)) {
      var obj = roots[objptr];
      if (obj instanceof JSIL.Variable)
	return obj.value;
      return obj;
    }
  }

  return null;
};
