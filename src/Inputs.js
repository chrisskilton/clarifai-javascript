let axios = require('axios');
let Input = require('./Input');
let {API, replaceVars} = require('./constants');
let {INPUT_PATH, INPUTS_PATH, INPUTS_STATUS_PATH, SEARCH_PATH} = API;
let {wrapToken, formatInput, formatImagesSearch, formatConceptsSearch} = require('./utils');
let {isSuccess, checkType} = require('./helpers');
const MAX_BATCH_SIZE = 128;

/**
* class representing a collection of inputs
* @class
*/
class Inputs {
  constructor(_config, rawData=[]) {
    this._config = _config;
    this.rawData = rawData;
    rawData.forEach((inputData, index)=> {
      if (inputData.input && inputData.score) {
        inputData.input.score = inputData.score;
        inputData = inputData.input;
      }
      this[index] = new Input(this._config, inputData);
    });
    this.length = rawData.length;
  }
  /**
  * Get all inputs in app
  * @param {Object}    options  Object with keys explained below: (optional)
  *   @param {Number}    options.page  The page number (optional, default: 1)
  *   @param {Number}    options.perPage  Number of images to return per page (optional, default: 20)
  * @return {Promise(inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
  */
  list(options) {
    let url = `${this._config.apiEndpoint}${INPUTS_PATH}`;
    return wrapToken(this._config, (headers)=> {
      return new Promise((resolve, reject)=> {
        axios.get(url, {
          headers,
          params: {
            'page': options.page,
            'per_page': options.perPage,
          }
        }).then((response)=> {
          if (isSuccess(response)) {
            resolve(new Inputs(this._config, response.data.inputs));
          } else {
            reject(response);
          }
        }, reject);
      });
    });
  }
  /**
  * Adds an input or multiple inputs
  * @param {object|object[]}        inputs                                Can be a single media object or an array of media objects
  *   @param {object|string}          inputs[].input                        If string, is given, this is assumed to be an image url
  *     @param {string}                 inputs[].input.(url|base64)           Can be a publicly accessibly url or base64 string representing image bytes (required)
  *     @param {string}                 inputs[].input.inputId                ID of input (optional)
  *     @param {number[]}               inputs[].input.crop                   An array containing the percent to be cropped from top, left, bottom and right (optional)
  *     @param {object[]}               inputs[].input.concepts               An array of concepts to attach to media object (optional)
  *       @param {object|string}          inputs[].input.concepts[].concept     If string, is given, this is assumed to be concept id with value equals true
  *         @param {string}                 inputs[].input.concepts[].concept.id          The concept id (required)
  *         @param {boolean}                inputs[].input.concepts[].concept.value       Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
  * @return {Promise(inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
  */
  create(inputs) {
    if (checkType(/Object/, inputs) {
      inputs = [inputs];
    }
    let url = `${this._config.apiEndpoint}${INPUTS_PATH}`;
    return wrapToken(this._config, (headers)=> {
      let requests = [];
      inputs = inputs.map(formatInput);
      let batches = Math.ceil(inputs.length/MAX_BATCH_SIZE);
      for (let batch = 0; batch < batches; batch++) {
        let start = batch * MAX_BATCH_SIZE;
        let end = start + MAX_BATCH_SIZE;
        let data = {
          'inputs': inputs.slice(start, end)
        };
        requests.push(
          new Promise((resolve, reject)=> {
            axios.post(url, data, {headers})
            .then((response)=> {
              if (isSuccess(response)) {
                resolve(new Inputs(this._config, response.data.inputs));
              } else {
                reject(response);
              }
            }, reject);
          })
        );
      }
      return new Promise((resolve, reject)=> {
        Promise.all(requests).then((responses)=> {
          let data = responses[0];
          responses.slice(1).forEach((response)=> {
            if (response['inputs']) {
              data['inputs'].push(response['inputs']);
            }
          });
          resolve(data);
        }).catch(reject);
      });
    });
  }
  /**
  * Get input by id
  * @param {String}    id  The input id
  * @return {Promise(input, error)} A Promise that is fulfilled with an instance of Input or rejected with an error
  */
  get(id) {
    let url = `${this._config.apiEndpoint}${replaceVars(INPUT_PATH, [id])}`;
    return wrapToken(this._config, (headers)=> {
      return new Promise((resolve, reject)=> {
        axios.get(url, {headers}).then((response)=> {
          if (isSuccess(response)) {
            resolve(new Input(this._config, response.data.input));
          } else {
            reject(response);
          }
        }, reject);
      });
    });
  }
  /**
  * Delete an input or a list of inputs by id or all inputs if no id is passed
  * @param {String}    id           The id of input to delete (optional)
  * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
  */
  delete(id=null) {
    let val;
    if (id === null) {
      let url = `${this._config.apiEndpoint}${replaceVars(INPUT_PATH, [id])}`;
      val = wrapToken(this._config, (headers)=> {
        return axios.delete(url, {headers});
      });
    } else if (Array.isArray(id)) {
      val = this._update('delete_inputs', inputs);
    } else {
      let url = `${this._config.apiEndpoint}${INPUTS_PATH}`;
      val = wrapToken(this._config, (headers)=> {
        return axios.delete(url, {headers});
      });
    }
    return val;
  }
  /**
  * Add concepts to inputs in bulk
  * @param {object[]}         inputs    List of concepts to update
  *   @param {object}           inputs[].input
  *     @param {string}           inputs[].input.id        The id of the input to update
  *     @param {string}           inputs[].input.concepts  Object with keys explained below:
  *       @param {object}           inputs[].input.concepts[].concept
  *         @param {string}           inputs[].input.concepts[].concept.id        The concept id (required)
  *         @param {boolean}          inputs[].input.concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
  * @return {Promise(inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
  */
  addConcepts(inputs) {
    return this._update('merge_concepts', inputs);
  }
  /**
  * Delete concepts to inputs in bulk
  * @param {object[]}         inputs    List of concepts to update
  *   @param {object}           inputs[].input
  *     @param {string}           inputs[].input.id        The id of the input to update
  *     @param {string}           inputs[].input.concepts  Object with keys explained below:
  *       @param {object}           inputs[].input.concepts[].concept
  *         @param {string}           inputs[].input.concepts[].concept.id        The concept id (required)
  *         @param {boolean}          inputs[].input.concepts[].concept.value     Whether or not the input is a positive (true) or negative (false) example of the concept (default: true)
  * @return {Promise(inputs, error)} A Promise that is fulfilled with an instance of Inputs or rejected with an error
  */
  deleteConcepts(inputs) {
    return this._update('delete_concepts', inputs);
  }
  _update(action, inputs) {
    let url = `${this._config.apiEndpoint}${INPUTS_PATH}`;
    let data = {
      action,
      'inputs': inputs.map((input)=> formatInput(input, false))
    };
    return wrapToken(this._config, (headers)=> {
      return new Promise((resolve, reject)=> {
        axios.patch(url, data, {headers})
        .then((response)=> {
          if (isSuccess(response)) {
            resolve(new Inputs(this._config, response.data.inputs));
          } else {
            reject(response);
          }
        }, reject);
      });
    });
  }
  /**
  * Search for inputs or outputs based on concepts or images
  *   @param {object[]}               ands          List of all predictions to match with
  *     @param {object}                 ands[].concept            An object with the following keys:
  *       @param {string}                 ands[].concept.type        Search over 'input' or 'output' (default: 'output')
  *       @param {string}                 ands[].concept.name        The concept name
  *       @param {boolean}                ands[].concept.value       Indicates whether or not the term should match with the prediction returned (default: true)
  *     @param {object}                 ands[].image              An image object that contains the following keys:
  *       @param {string}                 ands[].image.type          Search over 'input' or 'output' (default: 'output')
  *       @param {string}                 ands[].image.(base64|url)  Can be a publicly accessibly url or base64 string representing image bytes (required)
  *       @param {number[]}               ands[].image.crop          An array containing the percent to be cropped from top, left, bottom and right (optional)
  *   @param {concept[]|image[]}      ors           List of any predictions to match with
  *     @param {object}                 ors[].concept            An object with the following keys:
  *       @param {string}                 ors[].concept.type          Search over 'input' or 'output' (default: 'output')
  *       @param {string}                 ors[].concept.name          The concept name
  *       @param {boolean}                ors[].concept.value         Indicates whether or not the term should match with the prediction returned (default: true)
  *     @param {object}                 ors[].image              An image object that contains the following keys:
  *       @param {string}                 ors[].image.type            Search over 'input' or 'output' (default: 'output')
  *       @param {string}                 ors[].image.(base64|url)    Can be a publicly accessibly url or base64 string representing image bytes (required)
  *       @param {number[]}               ors[].image.crop            An array containing the percent to be cropped from top, left, bottom and right (optional)
  * @param {Object}                   options       Object with keys explained below: (optional)
  *    @param {Number}                  options.page          The page number (optional, default: 1)
  *    @param {Number}                  options.perPage       Number of images to return per page (optional, default: 20)
  * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
  */
  search(ands=[], ors=[], options={}) {
    let url = `${this._config.apiEndpoint}${SEARCH_PATH}`;
    let data = {
      'query': {
        'ands': []
      },
      'pagination': {
        'page': options.page,
        'per_page': options.perPage
      }
    };

    if (!Array.isArray(ands)) {
      ands = [ands];
    }
    if (!Array.isArray(ors)) {
      ors = [ors];
    }
    if (ands.length > 0) {
      data['query']['ands'] = ands.map(function(andQuery) {
        return andQuery.name?
          formatConceptsSearch(andQuery):
          formatImagesSearch(andQuery);
      });
    }
    if (ors.length > 0) {
      data['query']['ands'] = data['query']['ands'].concat({
        'ors': ors.map(function(orQuery) {
          return orQuery.name?
            formatConceptsSearch(orQuery):
            formatImagesSearch(orQuery);
        })
      });
    }
    return wrapToken(this._config, (headers)=> {
      return new Promise((resolve, reject)=> {
        axios.post(url, data, {headers})
        .then((response)=> {
          if (isSuccess(response)) {
            resolve(new Inputs(this._config, response.data.hits));
          } else {
            reject(response);
          }
        }, reject);
      });
    });
  }
  /**
  * Get inputs status (number of uploaded, in process or failed inputs)
  * @return {Promise(response, error)} A Promise that is fulfilled with the API response or rejected with an error
  */
  getStatus() {
    let url = `${this._config.apiEndpoint}${INPUTS_STATUS_PATH}`;
    return wrapToken(this._config, (headers)=> {
      return new Promise((resolve, reject)=> {
        axios.get(url, {headers})
        .then((response)=> {
          if (isSuccess(response)) {
            resolve(response.data);
          } else {
            reject(response);
          }
        }, reject);
      });
    });
  }
};

module.exports = Inputs;
