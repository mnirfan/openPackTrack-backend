let models = require('../models')
let sequelize = require('sequelize')
const paginate = require('express-paginate');

module.exports = {
  create: function(req,res){
    var result= {
      success: false,
      status: "ERROR",
      inner: null,
    }
    let isInStok = parseInt(req.body.isInStok)

    models.Inner.create({
      barcode: req.body.barcode,
      itemId: req.body.itemId,
      cartonId: req.body.cartonId,
      isInStok: isInStok,
      gradeId: req.body.gradeId,
      sourceId: req.body.sourceId
    }).then(inner=>{
      result.success = true
      result.status = "OK"
      result.inner = inner
      res.json(result)
    }).catch(err=>{
      if (err.errors) {
        result.errors = err.errors
      }
      result.message=err.message
      res.json(result)
      console.log('Error when trying to create new inner : ', err)
    })
  },

  all: function (req,res) {
    var result = {
      success: false,
      pagination: null,
      inners: null
    }
    var allowedSort = ['updatedAt', 'item', 'carton', 'stock', 'grade', 'source']
    var order = []
    var allowedDirection = ['ASC', 'DESC']
    if (req.query.sortDirection) {
      req.query.sortDirection = req.query.sortDirection.toUpperCase()
    }
    if (allowedDirection.indexOf(req.query.sortDirection) == -1) {
      req.query.sortDirection = 'ASC'
    }
    if (allowedSort.indexOf(req.query.sortBy) == -1) {
      req.query.sortBy = 'updatedAt'
      order = [['updatedAt', req.query.sortDirection]]
    }
    else if (req.query.sortBy == 'item'){
      order = [[{model: models.Item, as: 'item'}, 'code', req.query.sortDirection]]
    }
    else if (req.query.sortBy == 'carton') {
      order = [[{model: models.Carton, as: 'carton'}, 'barcode', req.query.sortDirection]]
    }
    else if (req.query.sortBy == 'stock') {
      order = [['isInStok', req.query.sortDirection]]
    }
    else if (req.query.sortBy == 'grade') {
      order = [[{model: models.InnerGrade, as: 'innerGrade'}, 'name', req.query.sortDirection]]
    }
    else {
      order = [[{model: models.InnerSource, as: 'innerSource'}, 'name', req.query.sortDirection]]
    }
    if (req.query.search == null) {
      req.query.search = ''
    }
    var text = req.query.search
    models.Inner.findAndCountAll({
      logging: console.log,
      attributes: ['barcode', 'isInStok', 'createdAt', 'updatedAt'],
      include: [
        {
          model: models.Carton,
          as: 'carton',
          include: [
            {
              model: models.Warehouse,
              as: 'warehouse',
              attributes: {
                exclude: ['createdAt', 'updatedAt']
              }
            }
          ],
          attributes: {
            exclude: ['createdAt', 'updatedAt']
          }
        },
        {
          model: models.Item,
          as: 'item',
          attributes: {
            exclude: ['createdAt', 'updatedAt']
          }
        },
        {
          model: models.InnerGrade,
          as: 'innerGrade',
          attributes: {
            exclude: ['createdAt', 'updatedAt']
          }
        },
        {
          model: models.InnerSource,
          as: 'innerSource',
          attributes: {
            exclude: ['createdAt', 'updatedAt']
          }
        }
      ],
      where: {
        $or: [
          sequelize.where(sequelize.col('Inner.barcode'), { $ilike: `%${text}%`}),
          sequelize.where(sequelize.col('carton.barcode'), { $ilike: `%${text}%`}),
          sequelize.where(sequelize.col('carton->warehouse.name'), { $ilike: `%${text}%`}),
          sequelize.where(sequelize.col('item.code'), { $ilike: `%${text}%`}),
        ]
      },
      limit: req.query.limit,
      offset: req.skip,
      order: order
    })
    .then(inners=>{
      pageCount = Math.ceil(inners.count / req.query.limit)
      result.success= true
      result.inners= inners.rows
      result.pagination = {
        total: inners.count,
        pageCount: pageCount,
        currentPage: req.query.page,
        hasNextPage: paginate.hasNextPages(req)(pageCount),
        hasPrevPage: res.locals.paginate.hasPreviousPages
      }
      res.json(result)
    }).catch(err=>{
      if(err.errors){
        result.errors = err.errors
      }
      else {
        result.errors = err
      }
      result.message=err.message
      res.json(result)
      console.log(err);
    })
  },

  detail: function(req, res) {
    var result = {
      success: false
    }
    models.Inner.find({
      where: {
        barcode: req.params.barcode
      },
      include: [
        {
          model: models.Item,
          as: 'item',
          attributes: {
            exclude: ['createdAt', 'updatedAt']
          }
        },
        {
          model: models.Carton,
          as: 'carton',
          attributes: ['barcode']
        },
        {
          model: models.InnerGrade,
          as: 'innerGrade',
          attributes: ['name']
        }
      ]
    })
    .then(inner=>{
      if (inner) {
        var _inner = JSON.parse(JSON.stringify(inner));
        delete _inner.itemId
        result.inner = _inner
        res.json(result)
      }
      else {
        res.json(inner)
      }
    })
    .catch(err=>{
      if(err.errors){
        result.errors = err.errors
      }
      else {
        result.errors = err
      }
      res.json(result)
    })
  },

  ping: function(req, res){
    var result = {
      success: false
    }
    models.Inner.find({
      where: {
        barcode: req.params.barcode
      }
    })
    .then(inner=>{
      result.success = true
      if (inner) {
        result.exist = true
      }
      else {
        result.exist = false
      }
      res.json(result)
    })
    .catch(err=>{
      if(err.errors){
        result.errors = err.errors
      }
      else {
        result.errors = err
      }
      res.json(result)
    })
  },

  inputScan: function(req, res){
    var result = {
      success: false
    }

    if(req.body.cartonBarcode && req.body.innerCodes && parseInt(req.body.profileId) == req.body.profileId){
      try{
        var innerCodes = JSON.parse(req.body.innerCodes)
        models.Carton.findOne({
          where: {
            barcode: req.body.cartonBarcode
          }
        })
        .then(carton=>{
          if (carton) {
            console.log('rejecting..');
            return Promise.reject({message: 'carton already registered'})
          }
          else {
            return Promise.all(innerCodes.map(inner=>{
              return models.Inner.findOne({
                where: {barcode: inner.barcode}
              })
              .then(data=>{
                if (data) {
                  return Promise.reject({message: 'innerbox already exist'})
                }
                else {
                  return true
                }
              })
            }))
          }
        })
        .then(()=>{
          // console.log(models.sequelize.transaction)
          return models.sequelize.transaction(function (t) {
            return models.Carton.create({
              barcode: req.body.cartonBarcode,
              profileId: req.body.profileId
            }, {
              transaction: t
            })
            .then(carton=>{
              return models.Item.findAll({
                where: {
                  $or: innerCodes.map(inner=>{
                    return {code: inner.itemCode}
                  })
                },
                attributes: ['id', 'code'],
                transaction: t
              })
              .then(items=>{
                if (!items) {
                  // return Promise.reject('item not found')
                  throw new Error({message: 'item not found'})
                }
                var itemIdCodes = {}
                items.forEach(item=>{
                  itemIdCodes[item.dataValues.code] = item.dataValues.id
                })
                console.log(items);
                var innerToCreate = innerCodes.map(inner=>{
                  return {
                    barcode: inner.barcode,
                    itemId: itemIdCodes[inner.itemCode],
                    cartonId: carton.id
                  }
                })
                return models.Inner.bulkCreate(innerToCreate, {transaction: t})
              })
            })
          })
        })
        .then(inners=>{
          result.success = true
          res.json(result)
        })
        .catch(err=>{
          if(err.errors){
            result.errors = err.errors
          }
          else if (err.message) {
            result.message = err.message
          }
          else{
            result.errors = err
          }
          res.json(result)
        })
      }
      catch(err){
        result.message = "Inner Barcodes must be a valid JSON array"
        res.status(412).json(result)
      }
    }
    else {
      result.message = "Invalid Parameter"
      res.status(412).json(result)
    }
  }
}
