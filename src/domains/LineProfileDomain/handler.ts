"use strict";

import { LineProfileSercvice } from "./service";



/**
 * 
 */
const api = async(event): Promise<any> => {
    return LineProfileSercvice.getProfile(event)
};

export { api };