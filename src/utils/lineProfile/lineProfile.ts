import axios from 'axios';

/**
 * LineのUtils
 */
export class LineProfileUtils {
    /**
     * lineのメッセージが送られてきた場合に返信
     */
    public static async getProfileWithAccessToken(accessToken: string){
        const url = 'https://api.line.me/v2/profile';
        try{
            const ret = (await axios.get(url,{
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                }
            })).data
            console.log(`データは${JSON.stringify(ret)}`)
            return ret as {userId: string; displayName: string; pictureUrl: string; statusMessage: string}
        } catch(e) {
            console.log(e)
        }
    }

    public static async getProfileWithIdToken({idToken}: {
      idToken: string;
    }){
        const url = 'https://api.line.me/oauthv2/v2.1/verify';
        try{
            const ret = (await axios.post(url, {
                "id_token": idToken
            },
            {
                headers: {
                    "Content-Type": "application/json",
                }
            })).data
            return ret
        } catch(e) {
            console.log(e)
        }
    }
}