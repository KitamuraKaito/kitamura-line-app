'use strict';

import dayjs from "dayjs";

import aws from 'aws-sdk';
const dynamo = new aws.DynamoDB.DocumentClient({region: 'ap-northeast-1'});

export interface UserEntity {
    user_id: string;
    user_name: string;
    line_id: string;
    line_name: string;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}

/**
 * User用のmodel
 */
export class UserModel{
    /**
     * User情報を作成
     */
    async createUser({userId, userName, lineId}: {
        userId: string;
        userName: string;
        lineId: string;
    }): Promise<void> {
        await dynamo.put({
            TableName: 'kitamura-app-users-dev',
            Item: {
                'user_id': userId,
                'line_name': userName,
                'line_id': lineId,
                'created_at': dayjs().toISOString(),
                'updated_at': dayjs().toISOString(),
                'deleted_at': '0001-01-01T00:00:00Z' 
            }
        }).promise()
    }
}
export const userModel = new UserModel()