"use strict";

import { apigateway } from '../../utils/decorator/requestDecorator';
import { LineUtils } from '../../utils/line/line';
import S3 from 'aws-sdk/clients/s3';
import AWS from 'aws-sdk';
import sharp from 'sharp';
import axios from 'axios';
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
            Key: 'img/' + path,
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
                Key: 'img/' + path,
            }).promise()

            return kekka.Body
        } catch {
            throw 'error!'
        }
    }

    /**
     * 元画像から人の顔を認識し，そこに画像を貼り付ける
     * 画像の認識はAWSのRekognitionで，加工は自前のlambda上で行う
     * @param image 編集する画像
     * @param path 元画像のS3上のパス（画像認識用）
     * @param maskImage 顔に貼り付ける画像（マスク画像）
     */
    static async changeImage(image, path, maskImage) {
        const maskImageSharp = await sharp(maskImage);

        // S3上にあらかじめ保存されている元画像から，人間の顔を認識し，座標を取得
        const reko = new AWS.Rekognition();
        const params = {
            Image: {
                S3Object: {
                    Bucket: 'obake',
                    Name: `img/${path}`
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
     * ユーザーがあらかじめ送信した画像を，マスク画像としてセット
     * @param imageName S3上に保存した画像の名前
     * @param userId ユーザーのlineId
     */
    static async setUserMask(imageName, userId){
        const image = await this.getImageFromS3(`${userId}/original/${imageName}`).catch(() => {
            throw 'not found'
        })

        const userMaskPath = `${userId}/userMask/um.jpg`
        await this.saveImageToS3(image, userMaskPath)
    }

    /**
     * ユーザーがセットしたマスク画像を取得．なければもともと用意した画像を取得
     * @param userId ユーザーのlineId
     */
    static async getUserMask(userId) {
        try {
            return await this.getImageFromS3(`${userId}/userMask/um.jpg`)
        } catch {
            return await this.getImageFromS3('default.png');
        }
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
                } else if(eve.type === 'follow') {
                } else if(eve.type === 'message') {
                    const userId = eve.source.userId;

                    if(eve.message.type === 'image') {
                        const resposeImage = await this.getImageByLineApi(eve.message.id)
                        const resposeImageName = `ori${eve.message.id}.jpg`;
                        const resposeImagePath = `${userId}/original/${resposeImageName}`
                        await this.saveImageToS3(resposeImage, resposeImagePath)
                        await LineUtils.replyMessage({replyToken: eve.replyToken, message: `加工中！ちょっと待ってね！\nファイル名：${resposeImageName}`})

                        const userMaskImage = await this.getUserMask(userId)
                        const retouchedImage = await this.changeImage(resposeImage, resposeImagePath, userMaskImage)
                        const retouchedImageName = `ret${eve.message.id}.jpg`;
                        const retouchedImagePath = `${userId}/retouched/${retouchedImageName}`
                        await this.saveImageToS3(retouchedImage, retouchedImagePath)
                        await LineUtils.sendImageMessage({userId: userId, imageUrl: `https://obake.s3.ap-northeast-1.amazonaws.com/img/${retouchedImagePath}`})
                    }else{
                        // メッセージ送信でテスト
                        if(!eve.message.text.indexOf('セット：')) {
                            const maskImageName = eve.message.text.substring(('セット：').length)
                            try{
                                await this.setUserMask(maskImageName, userId)
                                await LineUtils.postMessage({userId: userId, message: 'セット完了！'})
                            } catch {
                                await LineUtils.postMessage({userId: userId, message: 'そんな名前の画像はないよ'})
                            }
                        } else {
                            await LineUtils.replyMessage({replyToken: eve.replyToken, message: '今日も元気'})
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

