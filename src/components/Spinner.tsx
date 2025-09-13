/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

const Spinner: React.FC = () => {
  return (
    <div role="status" className="spinner-container">
      <div className="spinner-cube">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Spinner;