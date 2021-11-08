"use strict";

import { apigateway } from '../../utils/decorator/requestDecorator';
import { LineProfileUtils } from '../../utils/lineProfile/lineProfile';


/**
 * LineService
 */
export class LineProfileSercvice {
    /**
     * 
     */
    @apigateway()
    static async getProfile(event) {
        console.log(event)
        if(event.body === null) return 
        const body = JSON.parse(event.body)
        try{
            if(body.tokenType === 'access') {
                await LineProfileUtils.getProfileWithAccessToken(body.accessToken)
            } else if(body.tokenType === 'id' || false) {
                await LineProfileUtils.getProfileWithIdToken(body.idToken)
            }
        } catch(err) {
            console.log(err)
        }
        return {result: "ok"}
    }
}
