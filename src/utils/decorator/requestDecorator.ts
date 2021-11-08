"use strict";

import { APIGatewayEvent } from "aws-lambda";
import util from 'util';
/**
 * APIGateway Response
 */
export interface ApigatewayResponse {
    statusCode: number;
    headers: any;
    body: string; // json string
}


/**
 * レスポンスの形成
 */
const ResponseJson = (ret: any, status: number): ApigatewayResponse => {
  return {
      statusCode: status,
      headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "OPTIONS,DELETE,PUT,POST,GET",
          "Access-Control-Allow-Headers": "X-Line-Signature",
          "Access-Control-Expose-Headers": "X-Line-Signature"
      },
      body: JSON.stringify(ret)
  };
};

/**
 * API Gateway用のレスポンスを作成する
 */
export const getApiGatewayResponse = (ret: any): ApigatewayResponse => {
  // 正常時のレスポンス
  return ResponseJson(ret, 200);
};

/**
 * API Gatewayを利用するServiceメソッドに付与する
 */
export const apigateway = () => {
  return (
    target: any,
    propKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    console.log(propKey)
    const original = descriptor.value;
    descriptor.value = async (...args: APIGatewayEvent[]): Promise<any> => {
      // DBに接続
      try {
        const result = await original.apply(target, args);
        const ret = getApiGatewayResponse(result);
        return ret
      } catch (err){
        console.log(util.inspect(err, false, null));
        console.log("error is: " + err.message);
        return getApiGatewayResponse(err);
      }
    };
    return descriptor;
  };
};