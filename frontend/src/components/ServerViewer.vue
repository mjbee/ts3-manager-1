<template>
<v-container>
  <v-layout>
    <v-flex md8 sm10 xs12 offset-md2 offset-sm1>
      <v-card>
        <v-card-title>{{ serverInfo.virtualserver_name }}</v-card-title>
        <v-card-text>
          <v-treeview :items="channelTree" :open="itemIDs" dense>
            <template #label="{ item }">
              <channel v-if="item.channel_name" :channel="item" :queryUser="queryUser"></channel>
              <client v-else :client="item" :avatarList="clientAvatars"></client>
            </template>
          </v-treeview>
        </v-card-text>
      </v-card>
    </v-flex>
  </v-layout>

  <v-btn fab color="primary" fixed bottom right dark :to="{name: 'channel-add'}">
    <v-icon>add</v-icon>
  </v-btn>
</v-container>
</template>
<script>
import loadAvatars from "@/mixins/loadAvatars"

export default {
  mixins: [
    loadAvatars
  ],
  components: {
    Channel: () => import('@/components/ServerViewerChannel'),
    Client: () => import('@/components/ServerViewerClient'),
  },
  data() {
    return {
      serverInfo: {},
      channelList: [],
      clientList: [],
      itemIDs: [],
      channelTree: [],
      currentChannel: {},
      textPrivates: [],
    }
  },
  computed: {
    queryUser: {
      get() {
        return this.$store.state.query.queryUser
      },
      set(value) {
        this.$store.commit("saveUserInfo", value)
      }
    }
  },
  methods: {
    // Props to http://oskarhane.com/create-a-nested-array-recursively-in-javascript/
    createNestedList(list, itemID = 0) {
      let out = []

      for (let item of list) {
        if (item.parent_item_id == itemID) {
          let children = this.createNestedList(list, item.item_id)

          if (children.length) {
            item.children = children
          }

          out.push(item)
        }
      }

      return out
    },
    addEventListeners() {
      this.$TeamSpeak.on('clientmoved', this.loadChannelTree)
      this.$TeamSpeak.on('clientconnect', this.loadChannelTree)
      this.$TeamSpeak.on('clientdisconnect', this.loadChannelTree)
      this.$TeamSpeak.on('channeldelete', this.loadChannelTree)
    },
    removeEventListeners() {
      this.$TeamSpeak.__proto__.removeEventListener('clientmoved', this.loadChannelTree)
      this.$TeamSpeak.__proto__.removeEventListener('clientconnect', this.loadChannelTree)
      this.$TeamSpeak.__proto__.removeEventListener('clientdisconnect', this.loadChannelTree)
      this.$TeamSpeak.__proto__.removeEventListener('channeldelete', this.loadChannelTree)
    },
    openAllChannels() {
      this.channelList.forEach(channel => this.itemIDs.push(`${channel.cid}-channel`))
    },
    getServerInfo() {
      return this.$TeamSpeak.execute('serverinfo').then(serverinfo => serverinfo[0])
    },
    getChannelList() {
      return this.$TeamSpeak.execute('channellist')
    },
    getClientList() {
      return this.$TeamSpeak.execute('clientlist', {}, ['-voice', '-away'])
    },
    whoAmI() {
      return this.$TeamSpeak.execute('whoami').then(list => list[0])
    },
    mergedList(clientlist, channellist) {
      return [...clientlist, ...channellist].map(item => {
        if (item.client_nickname) {
          return {
            id: `${item.clid}-client`,
            name: item.client_nickname,
            parent_item_id: item.cid,
            item_id: null,
            ...item
          }
        } else {
          return {
            id: `${item.cid}-channel`,
            name: item.channel_name,
            item_id: item.cid,
            parent_item_id: item.pid,
            ...item
          }
        }
      })
    },
    getCurrentChannel(channelList, queryUser) {
      return channelList.find(channel => channel.cid === queryUser.client_channel_id)
    },
    async updateCurrentChannel() {
      try {
        this.queryUser = await this.whoAmI()

        this.currentChannel = this.getCurrentChannel(this.channelList, this.queryUser)
      } catch (err) {
        this.$toast.error(err.message)
      }
    },
    async loadChannelTree() {
      try {
        this.channelList = await this.getChannelList()
        this.clientList = await this.getClientList()

        this.channelTree = this.createNestedList(this.mergedList(this.clientList, this.channelList))

        this.openAllChannels()
      } catch (err) {
        this.$toast.error(err.message)
      }

      this.updateCurrentChannel()
    }
  },
  async created() {
    try {
      this.serverInfo = await this.getServerInfo()
      this.serverInfo.unread_messages = 0
      this.channelList = await this.getChannelList()
      this.clientList = await this.getClientList()
      this.queryUser = await this.whoAmI()
      this.channelTree = this.createNestedList(this.mergedList(this.clientList, this.channelList))
      this.currentChannel = this.getCurrentChannel(this.channelList, this.queryUser)

      this.openAllChannels()

      this.addEventListeners()

      this.loadClientAvatars(this.clientList.map(client => client.client_database_id))
    } catch (err) {
      this.$toast.error(err.message)
    }
  },
  beforeRouteLeave(from, to, next) {
    this.removeEventListeners()

    next()
  }
}
</script>
