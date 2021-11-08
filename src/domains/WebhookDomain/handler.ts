"use strict";

import { LineSercvice } from "./service";

/**
 * LineServer 
 * webhook
 */
const webhook = async(event): Promise<any> => {
    return LineSercvice.webhook(event)
};

export { webhook };