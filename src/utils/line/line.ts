import axios from 'axios';

/**
 * LineのUtils
 */
export class LineUtils {
    /**
     * 返信
     */
    public static async replyMessage({replyToken, message}: {
        replyToken: string;
        message: string;
    }){
        const url = 'https://api.line.me/v2/bot/message/reply';
        try{
            await axios.post(url, {
                "replyToken": replyToken,
                "messages": [{
                    "type": "text",
                    "text": message
                }]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.line_token}`,
                }
            });
        } catch(e) {
            console.log(e)
        }
    }

    /**
     * 指定のユーザーに画像返信
     */
    public static async sendImageMessage({userId, imageUrl}: {
        userId: string;
        imageUrl: string;
    }){
        const url = 'https://api.line.me/v2/bot/message/push';
        try{
            await axios.post(url, {
                "to": userId,
                "messages": [{
                    "type": "image",
                    "originalContentUrl": imageUrl,
                    "previewImageUrl": imageUrl
                }]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.line_token}`,
                }
            });
        } catch(e) {
            console.log(e.response.data.details)
        }
    }

    /**
     * 指定のユーザーにメッセージを送信
     */
    public static async postMessage({userId, message}: {
        userId: string;
        message: string;
    }){
        const url = 'https://api.line.me/v2/bot/message/push';
        try{
            await axios.post(url, {
                "to": userId,
                "messages": [{
                    "type": "text",
                    "text": message
                }]
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.line_token}`,
                }
            });
        } catch(e) {
            console.log(e)
        }
    }

    /**
     * userIdからユーザーの情報を取得
     */
    public static async getUserProfile(userId: string){
        const url = `https://api.line.me/v2/bot/profile/${userId}`;
        try{
            const ret = (await axios.get(url,{
                headers: {
                    "Authorization": `Bearer ${process.env.line_token}`,
                }
            })).data
            return ret as {displayName: string; userId: string;}
        } catch(e) {
            console.log(e)
        }
    }
}