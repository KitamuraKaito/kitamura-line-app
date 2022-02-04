"use strict";

import { apigateway } from '../../utils/decorator/requestDecorator';
import { LineUtils } from '../../utils/line/line';
import S3 from 'aws-sdk/clients/s3';
import AWS from 'aws-sdk';
import sharp from 'sharp';
import axios from 'axios';

// 表情タイプ
export const MaskImageType = {
    NOMAL: 'NOMAL',
    SMILE: 'SMAIL',
} as const;

// S3の環境
export const s3 = new S3({
    accessKeyId: process.env.aws_access_key,
    secretAccessKey: process.env.aws_secret_key,
    region: 'ap-northeast-1'
});

/**
 * LineService
 */
export class LineSercvice {
    /**
     * LINEに送信された画像を，LINEのAPIを使用し取得
     * @param contentId LINEサーバー内に保存される際の識別用id
     */
    static async getImageByLineApi(contentId) {
        console.log(contentId)

        const url = `https://api-data.line.me/v2/bot/message/${contentId}/content`;
        try{
            const res = await axios.get(url, {
                headers: {
                    "Authorization": `Bearer ${process.env.line_token}`,
                },
                responseType: 'arraybuffer'
            })
            console.log(res.data)
        
            return res.data
        } catch(err) {
            console.log(err)
        }
    }

    /**
     * S3に画像を保存
     * @param data 保存する画像
     * @param path 保存する画像のS3でのパス
     */
    static async saveImageToS3(data, path) {
        const s3 = new S3({
            accessKeyId: process.env.aws_access_key,
            secretAccessKey: process.env.aws_secret_key,
            region: 'ap-northeast-1'
        });

        // S3の場所を指定し保存
        const result = await s3.putObject({
            Bucket: 'obake',
            Key: path,
            Body: data,
            ACL: 'public-read',
        }).promise()
        console.log('S3の番号' + result.toString())
    }

    /**
     * S3から画像を取得
     * @param path 取得する画像のS3でのパス
     */
    static async getImageFromS3(path) {
        const s3 = new S3({
            accessKeyId: process.env.aws_access_key,
            secretAccessKey: process.env.aws_secret_key,
            region: 'ap-northeast-1'
        });

        try{
            const kekka = await s3.getObject({
                Bucket: 'obake',
                Key: path,
            }).promise()

            return kekka.Body
        } catch {
            throw 'error!'
        }
    }

    /**
     * ユーザーの送信した画像の中で，最も新しい画像の名前を取得する
     * @param userId 対象のユーザーのID
     */
    static async getLatestImageFromS3(userId) {
        const s3 = new S3({
            accessKeyId: process.env.aws_access_key,
            secretAccessKey: process.env.aws_secret_key,
            region: 'ap-northeast-1'
        });

        const params = {
            'Bucket':'obake',
            'Prefix':`img/${userId}/original`,
        }
      
        // 最終更新日順にソート
        const lists = await s3.listObjectsV2(params).promise();
        const sortedList = lists.Contents.sort((a, b) => Number(b.LastModified) - Number(a.LastModified));
        
        return sortedList[0].Key;
    }

    /**
     * ユーザーがあらかじめ送信した画像を，マスク画像としてセット
     * @param imageName S3上に保存した画像の名前
     * @param userId ユーザーのlineId
     * @param type 顔の表情タイプ
     */
    static async setUserMask(imageName, userId, type){
        let userMaskPath;
        const image = await this.getImageFromS3(`${userId}/original/${imageName}`).catch(() => {
            throw 'not found'
        })

        if (type === MaskImageType.NOMAL) {
            userMaskPath = `img/${userId}/userMask/um.jpg`
        } else if(type === MaskImageType.SMILE) {
            userMaskPath = `img/${userId}/userSmileMask/sm.jpg`
        }

        await this.saveImageToS3(image, userMaskPath)
    }

    /**
     * ユーザーがセットしたマスク画像を取得．なければもともと用意した画像を取得
     * @param userId ユーザーのlineId
     * @param type 顔の表情タイプ
     */
    static async getUserMask(userId, type) {
        try {
            if (type === MaskImageType.NOMAL) {
                return await this.getImageFromS3(`img/${userId}/userMask/um.jpg`)
            } else if(type === MaskImageType.SMILE) {
                return await this.getImageFromS3(`img/${userId}/userSmileMask/sm.jpg`)
            }
        } catch {
            return await this.getImageFromS3('img/default.png');
        }
    }

    /**
     * 元画像から人の顔を認識し，そこに画像を貼り付ける
     * 画像の認識はAWSのRekognitionで，加工は自前のlambda上で行う
     * @param userId 対象のユーザーのID
     * @param image 編集する画像
     * @param path 元画像のS3上のパス（画像認識用）
     */
    static async changeImage(userId, image, path) {
        let maskImage;
        let maskImageSharp;

        // S3上にあらかじめ保存されている元画像から，人間の顔を認識し，座標を取得
        const reko = new AWS.Rekognition();
        const params = {
            Image: {
                S3Object: {
                    Bucket: 'obake',
                    Name: `${path}`
                },
            },
            Attributes: ['ALL']
        }
        const df = await reko.detectFaces(params).promise()
        const dffd = df.FaceDetails

        // 元画像のサイズを取得
        const simage = await sharp(image);
        const size = await simage.metadata();

        let tmpBuff = image;
        // 人の顔ごとにマスク画像を合成
        for await (let fd of dffd) {
            // 表情によって合成する画像を変える
            if (fd.Smile.Value === true) {
                maskImage = await this.getUserMask(userId, MaskImageType.SMILE);
                maskImageSharp = await sharp(maskImage);
            } else {
                maskImage = await this.getUserMask(userId, MaskImageType.NOMAL);
                maskImageSharp = await sharp(maskImage);
            }

            // マスク画像を人の顔に合わせてリサイズ
            const resizeMaskImage = await maskImageSharp.resize({
                width: parseInt((fd.BoundingBox.Width * size.width).toString(10)),
                height: parseInt((fd.BoundingBox.Height * size.height).toString(10)),
                fit: 'fill'
            }).toBuffer()

            // リサイズしたマスク画像を合成
            const tmpSharp = await sharp(tmpBuff);
            tmpBuff = await tmpSharp.composite([{
                input: resizeMaskImage,
                blend: 'over',
                top: parseInt((fd.BoundingBox.Top * size.height).toString(10)),
                left: parseInt((fd.BoundingBox.Left * size.width).toString(10)),
            }]).toBuffer()
        }

        return tmpBuff
    }

    /**
     * webhookイベントを取得
     */
    @apigateway()
    static async webhook(event) {
        console.log(event)
        if(event.body === null) return 
        const events = JSON.parse(event.body).events
        for(const eve of events) {
            try{
                if(eve.type === 'join') {
                    // ToDo: グループ追加時処理の追加
                } else if(eve.type === 'follow') {
                    // ToDo: 友達登録時処理の追加
                } else if(eve.type === 'message') {
                    const userId = eve.source.userId;

                    if(eve.message.type === 'image') {
                        // 画像が送られてきた際の処理
                        // 画像の保存から加工まで
                        const responseImage = await this.getImageByLineApi(eve.message.id)
                        const responseImageName = `ori${eve.message.id}.jpg`;
                        const responseImagePath = `img/${userId}/original/${responseImageName}`
                        await this.saveImageToS3(responseImage, responseImagePath)
                        await LineUtils.replyMessage({replyToken: eve.replyToken, message: `加工中！ちょっと待ってね！\nファイル名：${responseImageName}`})

                        const retouchedImage = await this.changeImage(userId, responseImage, responseImagePath)
                        const retouchedImageName = `ret${eve.message.id}.jpg`;
                        const retouchedImagePath = `img/${userId}/retouched/${retouchedImageName}`
                        await this.saveImageToS3(retouchedImage, retouchedImagePath)
                        await LineUtils.sendImageMessage({userId: userId, imageUrl: `https://obake.s3.ap-northeast-1.amazonaws.com/${retouchedImagePath}`})
                    }else{
                        // メッセージ送信でテスト
                        // メッセージの内容で場合分け
                        if(!eve.message.text.indexOf('セット笑顔！')) {
                            try{
                                const maskImagePath = await this.getLatestImageFromS3(userId);
                                const maskImageName = await maskImagePath.substr(maskImagePath.lastIndexOf('/') + 1); // img/以下を切り出し
                                console.log(maskImageName)
                                await this.setUserMask(userId, maskImageName, MaskImageType.SMILE);
                                await LineUtils.postMessage({userId: userId, message: 'セット完了！'})
                            } catch {
                                await LineUtils.postMessage({userId: userId, message: 'セットする画像がないよ！'})
                            }
                        } else if(!eve.message.text.indexOf('セット普通！')) {
                            try{
                                const maskImagePath = await this.getLatestImageFromS3(userId);
                                const maskImageName = await maskImagePath.substr(maskImagePath.lastIndexOf('/') + 1); // img/以下を切り出し
                                console.log(maskImageName)
                                await this.setUserMask(userId, maskImageName, MaskImageType.NOMAL);
                                await LineUtils.postMessage({userId: userId, message: 'セット完了！'})
                            } catch {
                                await LineUtils.postMessage({userId: userId, message: 'セットする画像がないよ！'})
                            }
                        } else if (!eve.message.text.indexOf('使い方を教えて！')) {
                            await LineUtils.postMessage({userId: userId, message: '顔の映った画像を送信してね！'});
                            await LineUtils.postMessage({userId: userId, message: 'そのあとらしばらく待てば合成された画像が届くよ！'});
                        }else if(!eve.message.text.indexOf('合成する画像の変え方を教えて！')) {
                            await LineUtils.postMessage({userId: userId, message: 'まずは顔に合成したい画像を送ってね！'});
                            await LineUtils.postMessage({userId: userId, message: 'その次にメニューのMAGAOボタンかEGAOボタンを押したら合成画像をセットできるよ！'})
                        } else {
                            await LineUtils.replyMessage({replyToken: eve.replyToken, message: '今日も元気だぜ'})
                        }
                    }
                }
            } catch {
                continue
            }
        }
        return {result: "ok"}
    }
}

